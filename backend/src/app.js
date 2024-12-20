import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: "http://localhost:5173",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
//     sameSite: "none",
    optionsSuccessStatus: 200,
    secure: true

}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

        // router import
import userRouter from "./routes/user.routes.js";

        // router mount
app.use("/api/v1/users", userRouter);

// http://localhost:8000/api/v1/users/register

export default app;