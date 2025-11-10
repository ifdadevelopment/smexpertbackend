import mongoose from "mongoose";
import { config } from "dotenv";
config();

const connectionToDatabase = async () => {
    const dbPassword = process.env.DB_CONNECTION;
    try {
                // await mongoose.connect(`mongodb+srv://munnabahi:${dbPassword}@cluster0.7agg6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0/todo_app`);
        await mongoose.connect(`mongodb+srv://info_db_user:${dbPassword}@cluster0.bpjerhy.mongodb.net/`);
    } catch (error) {
        throw new Error("MongoDb Cloud Connection Failed");
    }
}

export default connectionToDatabase;