from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.repositories.user import user_repo
from app.core.security import verify_password
from app.core.exceptions import CredentialsException, NotFoundException

class AuthService:
    async def authenticate(
        self, db: AsyncSession, email: str, password: str
    ) -> Optional[User]:
        user = await user_repo.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def get_user(self, db: AsyncSession, user_id: int) -> User:
        user = await user_repo.get(db, id=user_id)
        if not user:
            raise NotFoundException(detail="User not found")
        return user

auth_service = AuthService()
