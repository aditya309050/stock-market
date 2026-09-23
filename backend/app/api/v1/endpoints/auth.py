from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core.security import create_access_token
from app.schemas.token import Token
from app.schemas.user import User, UserCreate
from app.services.auth import auth_service
from app.repositories.user import user_repo

router = APIRouter()


@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    clean_email = form_data.username.strip().lower()
    user = await auth_service.authenticate(
        db, email=clean_email, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password. Please check your credentials or create an account.",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is inactive.")
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
    }


@router.post("/register", response_model=User)
async def register_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    clean_email = str(user_in.email).strip().lower()
    user_in.email = clean_email
    if await user_repo.get_by_email(db, email=clean_email):
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists. Please sign in instead.",
        )
    return await user_repo.create(db, obj_in=user_in)
