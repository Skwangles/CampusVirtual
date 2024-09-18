cd Config

sudo apt install libpqxx-dev

docker-compose --env-file ../.env up -d

cd ..
echo "Note: You will have to change the credentials in all db.ts files in Apps/ to match - Goodluck!"