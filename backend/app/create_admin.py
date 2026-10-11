import getpass
from .database import Base, engine, SessionLocal
from .auth import User, hash_password

def main():
    Base.metadata.create_all(engine)
    email=input('Admin email: ').strip().lower()
    password=getpass.getpass('Admin password (at least 8 characters): ')
    if '@' not in email or len(password)<8: raise SystemExit('Invalid email or password.')
    with SessionLocal() as db:
        if db.query(User).filter_by(email=email).first(): raise SystemExit('Account already exists; no changes made.')
        db.add(User(email=email,name='Administrator',password_hash=hash_password(password),role='admin')); db.commit()
    print('Administrator created.')
if __name__=='__main__': main()
