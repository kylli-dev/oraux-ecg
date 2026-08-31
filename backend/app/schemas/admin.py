from typing import Literal, Optional
from pydantic import BaseModel, Field

Role = Literal["admin", "super_admin"]


class AdminLoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1)


class AdminCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8)
    role: Role = "admin"


class AdminUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=8)
    actif: Optional[bool] = None
    role: Optional[Role] = None


class AdminOut(BaseModel):
    id: int
    username: str
    actif: bool
    role: Role

    class Config:
        from_attributes = True
