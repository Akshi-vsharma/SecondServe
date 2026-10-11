import hashlib, hmac, secrets, os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, Session
from .database import Base, get_db

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(20), default='customer')

class LoginSession(Base):
    __tablename__ = 'login_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    expires: Mapped[datetime] = mapped_column(DateTime)

def hash_password(password):
    salt = secrets.token_hex(16)
    return salt + ':' + hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310000).hex()

def verify(password, stored):
    salt, digest = stored.split(':')
    return hmac.compare_digest(digest, hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310000).hex())

def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get('secondserve_session', '')
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest()) if token else None
    if not session or session.expires < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(401, 'Please sign in.')
    return db.get(User, session.user_id)

def require_admin(user: User = Depends(current_user)):
    if user.role != 'admin': raise HTTPException(403, 'Administrator access required.')
    return user

class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default='', max_length=100)

router = APIRouter(prefix='/auth')
def identity(user): return {'id':user.id,'name':user.name,'email':user.email,'role':user.role}
def establish(user, response, db):
    token = secrets.token_urlsafe(32)
    db.add(LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(),user_id=user.id,expires=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=7)))
    db.commit()
    response.set_cookie('secondserve_session', token, httponly=True, samesite='lax', secure=os.getenv('COOKIE_SECURE')=='true', max_age=604800, path='/')
    return identity(user)

@router.post('/register', status_code=201)
def register(data: Credentials, response: Response, db: Session=Depends(get_db)):
    email=data.email.strip().lower()
    if '@' not in email or not data.name.strip(): raise HTTPException(422,'Enter your name and a valid email.')
    if db.query(User).filter_by(email=email).first(): raise HTTPException(409,'An account with this email already exists.')
    user=User(email=email,name=data.name.strip(),password_hash=hash_password(data.password),role='customer')
    db.add(user); db.flush()
    return establish(user,response,db)

@router.post('/login')
def login(data: Credentials, response: Response, db: Session=Depends(get_db)):
    user=db.query(User).filter_by(email=data.email.strip().lower()).first()
    if not user or not verify(data.password,user.password_hash): raise HTTPException(401,'Email or password is incorrect.')
    return establish(user,response,db)

@router.get('/me')
def me(user:User=Depends(current_user)): return identity(user)

@router.post('/logout')
def logout(request:Request,response:Response,db:Session=Depends(get_db)):
    token=request.cookies.get('secondserve_session','')
    session=db.get(LoginSession,hashlib.sha256(token.encode()).hexdigest()) if token else None
    if session: db.delete(session); db.commit()
    response.delete_cookie('secondserve_session',path='/')
    return {'ok':True}
