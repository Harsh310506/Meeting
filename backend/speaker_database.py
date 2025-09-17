# Database configuration for speaker recognition system
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from speaker_models import Base
import logging

logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./meeting_speakers.db")

# Create engine with appropriate settings
if DATABASE_URL.startswith("sqlite"):
    # SQLite configuration
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "check_same_thread": False,
            "timeout": 30
        },
        poolclass=StaticPool,
        echo=False  # Set to True for SQL debugging
    )
else:
    # PostgreSQL/MySQL configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables():
    """Create all tables in the database"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """Initialize the database with tables"""
    logger.info("Initializing speaker recognition database...")
    create_tables()
    logger.info("Database initialization completed")


# Database utilities
class DatabaseManager:
    """Database manager for speaker recognition operations"""
    
    def __init__(self):
        self.engine = engine
        self.SessionLocal = SessionLocal
    
    def get_session(self):
        """Get a new database session"""
        return self.SessionLocal()
    
    def close_session(self, session):
        """Close a database session"""
        if session:
            session.close()
    
    def execute_query(self, query, params=None):
        """Execute a raw SQL query"""
        with self.engine.connect() as conn:
            if params:
                result = conn.execute(query, params)
            else:
                result = conn.execute(query)
            return result.fetchall()
    
    def backup_database(self, backup_path: str):
        """Create a backup of the database (SQLite only)"""
        if DATABASE_URL.startswith("sqlite"):
            import shutil
            db_path = DATABASE_URL.replace("sqlite:///", "")
            shutil.copy2(db_path, backup_path)
            logger.info(f"Database backup created: {backup_path}")
        else:
            logger.warning("Database backup not implemented for non-SQLite databases")
    
    def get_database_stats(self):
        """Get database statistics"""
        session = self.get_session()
        try:
            from speaker_models import Speaker, SpeakerUtterance, SessionMetadata
            
            stats = {
                "total_speakers": session.query(Speaker).count(),
                "total_utterances": session.query(SpeakerUtterance).count(),
                "total_sessions": session.query(SessionMetadata).count(),
                "active_speakers": session.query(Speaker).filter(Speaker.is_active == True).count()
            }
            return stats
        finally:
            self.close_session(session)


# Global database manager instance
db_manager = DatabaseManager()


# Database health check
def check_database_health():
    """Check if database is accessible and healthy"""
    try:
        session = SessionLocal()
        # Try a simple query
        session.execute("SELECT 1")
        session.close()
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


# Migration utilities
def migrate_database():
    """Run database migrations (placeholder for future use)"""
    logger.info("Running database migrations...")
    # Future: Implement Alembic migrations here
    create_tables()  # For now, just ensure tables exist
    logger.info("Database migrations completed")


if __name__ == "__main__":
    # Initialize database when run directly
    init_database()
    print("Database initialized successfully!")
    
    # Print database stats
    stats = db_manager.get_database_stats()
    print(f"Database Statistics: {stats}")