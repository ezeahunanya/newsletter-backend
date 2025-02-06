#!/bin/bash

SECRET_ID=$DB_SECRET_ID

# Use environment variables for host, port, and database name
HOST=$DB_HOST
PORT=$DB_PORT
DBNAME=$DB_NAME

secret=$(aws secretsmanager get-secret-value --secret-id $SECRET_ID --query SecretString --output text)

username=$(echo $secret | jq -r '.username')
password=$(echo $secret | jq -r '.password')

PGPASSWORD=$password psql -h $HOST -p $PORT -U $username -d $DBNAME
