import argparse
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    func,
    Table,
    MetaData,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base
import boto3
import json
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Base class for SQLAlchemy models
Base = declarative_base()


# Define subscribers table
def define_subscribers_table(name, metadata, **kwargs):
    return Table(
        name,
        metadata,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("email", String(255), nullable=False, unique=True),
        Column("first_name", String(100), nullable=True),
        Column("last_name", String(100), nullable=True),
        Column("subscribed", Boolean, default=True, nullable=False),
        Column("subscribed_at", DateTime, default=func.now(), nullable=False),
        Column("unsubscribed_at", DateTime, nullable=True),
        Column("email_verified", Boolean, default=False, nullable=False),
        Column("preferences", JSONB, nullable=False, default={}),  # Use JSONB here
    )


# Define token table
def define_tokens_table(name, metadata, subscriber_table_name=None, **kwargs):
    return Table(
        name,
        metadata,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column(
            "user_id",
            Integer,
            ForeignKey(f"{subscriber_table_name}.id"),
            nullable=False,
        ),
        Column("token_hash", String(255), nullable=False, index=True, unique=True),
        Column("token_type", String(50), nullable=False),
        Column("expires_at", DateTime, nullable=True),
        Column("used", Boolean, nullable=True),
        Column("created_at", DateTime, default=func.now(), nullable=False),
        Column("updated_at", DateTime, default=func.now(), nullable=False),
    )


# Prompt user for confirmation
def prompt_user(question: str) -> bool:
    while True:
        response = input(f"{question} (y/n): ").strip().lower()
        if response in ("y", "yes"):
            return True
        elif response in ("n", "no"):
            return False
        else:
            print("Invalid input. Please enter 'y' or 'n'.")


# Drop a table if it exists
def drop_table_if_exists(table_name, engine, metadata):
    try:
        table = Table(table_name, metadata, autoload_with=engine)
        table.drop(engine, checkfirst=True)
        metadata.remove(table)  # Remove the table from metadata
        print(f"The table '{table_name}' has been dropped.")
    except Exception as e:
        print(f"Error dropping the table '{table_name}': {e}")


# Create a table if it does not exist
def create_table_if_not_exists(table_name, engine, metadata, table_def, **kwargs):
    table = table_def(table_name, metadata, extend_existing=True, **kwargs)
    try:
        # Attempt to create the table without checkfirst
        table.create(engine)  # This will raise an error if the table exists
        print(f"The table '{table_name}' has been created successfully.")
    except Exception as e:
        # If the table already exists, catch the error and inform the user
        if "already exists" in str(e):
            print(
                f"The table '{table_name}' already exists. To overwrite it, use the '--overwrite' flag."
            )
        else:
            print(f"Error creating the table '{table_name}': {e}")


# Main execution
if __name__ == "__main__":
    # Parse arguments
    parser = argparse.ArgumentParser(description="Set up the database tables.")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow overwriting production table (use with caution).",
    )
    args = parser.parse_args()

    # Fetch database credentials from AWS Secrets Manager
    secret_name = os.getenv("SECRET_NAME")
    region_name = os.getenv("REGION")
    host = os.getenv("DB_HOST")
    database = os.getenv("DB_NAME")

    if not all([host, database]):
        raise ValueError("One or more required environment variables are missing.")

    session = boto3.session.Session()
    client = session.client(service_name="secretsmanager", region_name=region_name)

    try:
        # Retrieve secrets
        get_secret_value_response = client.get_secret_value(SecretId=secret_name)
        secret = json.loads(get_secret_value_response["SecretString"])

        # Extract credentials
        username = secret["username"]
        password = secret["password"]

        DATABASE_URL = f"postgresql://{username}:{password}@{host}:5432/{database}"

        # Set up the database engine
        engine = create_engine(DATABASE_URL)
        metadata = MetaData()  # Initialize metadata object

        # Handle dev tables (always drop and recreate)
        drop_table_if_exists("tokens_dev", engine, metadata)
        drop_table_if_exists("subscribers_dev", engine, metadata)
        create_table_if_not_exists(
            "subscribers_dev", engine, metadata, define_subscribers_table
        )
        create_table_if_not_exists(
            "tokens_dev",
            engine,
            metadata,
            define_tokens_table,
            subscriber_table_name="subscribers_dev",
        )

        # Handle production tables
        if args.overwrite:
            # Prompt before dropping and recreating production tables
            if prompt_user(
                "WARNING: Do you want to drop the production tables ('subscribers_prod' and 'tokens_prod')? This will remove all data!"
            ):
                drop_table_if_exists("tokens_prod", engine, metadata)
                drop_table_if_exists("subscribers_prod", engine, metadata)
                create_table_if_not_exists(
                    "subscribers_prod", engine, metadata, define_subscribers_table
                )
                create_table_if_not_exists(
                    "tokens_prod",
                    engine,
                    metadata,
                    define_tokens_table,
                    subscriber_table_name="subscribers_prod",
                )
            else:
                print("Skipping drop and recreation of production tables.")
        else:
            # Create production tables if they don't already exist
            create_table_if_not_exists(
                "subscribers_prod", engine, metadata, define_subscribers_table
            )
            create_table_if_not_exists(
                "tokens_prod",
                engine,
                metadata,
                define_tokens_table,
                subscriber_table_name="subscribers_prod",
            )

    except Exception as e:
        print(f"Error fetching database credentials or setting up the database: {e}")
