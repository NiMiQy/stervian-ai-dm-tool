import * as dotenv from "dotenv";
dotenv.config({ path: process.cwd() + "\\src\\.env" });
const configs = {
    // MYSQL: {
    //     host: process.env.DB_HOST ?? 'localhost',
    //     username: process.env.DB_USER,
    //     password: process.env.DB_PASSWORD,
    //     database: process.env.DB_DATABASE,
    // }
  DATABASE_URL: process.env.DB_URL
};

export default configs;