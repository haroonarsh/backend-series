import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

        // code to generate access token and refresh token for user
        // and save refresh token in db
const generateAccessTokenAndRefreshToken = async (userId) => {
            try {
                const user = await User.findById(userId);
                if (!user) {
                    throw new ApiError(404, "User not found");
                }
        
                const accessToken = user.generateAccessToken();
                const refreshToken = user.generateRefreshToken();
        
                user.refreshToken = refreshToken;
                await user.save({ validateBeforeSave: false });
        
                return { accessToken, refreshToken };
            } catch (error) {
                console.error("Error generating tokens:", error);
                throw new ApiError(500, "Something went wrong while generating access token and refresh token");
            }
};
        

        // register user
const registerUser = asyncHandler(async (req, res) => {
    // get user detail from frontend
    // validation - not empty or empty
    // check if user already exists: username, email
    // check for images, avatar
    // upload then to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {username, email, fullName, password} = req.body;
    console.log("email: ", email);

            // validation
    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

            // check if user already exists
    const existerUser = await User.findOne({
        $or: [{ email }, { password }]
    })
    if (existerUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    console.log(req.files);
    
            // check for images, avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

            // upload then to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!avatar) {
        throw new ApiError(400, "Failed to upload avatar");
    }

            // create user object - create entry in db
    const user = await User.create({
        fullName,
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase()
    })

            // remove password and refresh token field from response
    const createUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createUser) {
        throw new ApiError(500, "Somethis went wrong while registering user")
    }

            // return res
    return res.status(200).json(
        new ApiResponse(201, createUser, "User created successfully")
    )

})

        // login user
const loginUser = asyncHandler(async (req, res) => {
    // get user detail from frontend
    // username or password
    // validation - not empty or empty
    // check if user already exists: username, email
    // check for user creation  
    // return res

            // user detail
    const {email, username, password} = req.body;

            // validation
    if ([email || username || password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

            // username or password
    if (!email || !password) {
        throw new ApiError(400, "All fields are required");
    }

            // check if user already exists
    const existerUser = await User.findOne({
        $or: [{ email }, { username }]
    })
    if (!existerUser) {
        throw new ApiError(401, "Invalid email or password");
    }
            // password
    const isPasswordValid = await existerUser.comparePassword(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credintials");
    }

    const { accessToken, refreshToken } =  await generateAccessTokenAndRefreshToken(existerUser._id);
            
    const loggedInUser = await User.findById(existerUser._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully"))
    
});

const logoutUser = asyncHandler( async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged our successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decoded = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decoded?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used.");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessTokenAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token Refreshed succesfully")
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

export { registerUser, loginUser, logoutUser, refreshAccessToken };