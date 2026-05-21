from typing import Generator, AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.schemas.token import TokenPayload
from app.models.user import User
from app.services.auth import auth_service

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=["HS256"]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = await auth_service.get_user(db, user_id=int(token_data.sub))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_pro_user(
    current_user: User = Depends(get_current_active_user),
    # db: AsyncSession = Depends(get_db) -> In real app, query subscription table
) -> User:
    """Mock checking if user is pro or enterprise tier"""
    # For scaffolding, we just assume everyone is not pro by default unless logic added
    # if subscription.tier not in ["pro", "enterprise"]:
    #    raise HTTPException(status_code=403, detail="Pro subscription required")
    return current_user
