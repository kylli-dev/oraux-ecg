from typing import Optional
from pydantic import BaseModel, Field


class AdminLoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1)


class AdminCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8)


class AdminUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=8)
    actif: Optional[bool] = None


class AdminOut(BaseModel):
    id: int
    username: str
    actif: bool

    class Config:
        from_attributes = True
