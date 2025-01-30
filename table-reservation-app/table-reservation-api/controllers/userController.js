const User = require('../models/User');
const Food = require('../models/FoodModel');  // Import Food model
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetchUser = require('../middleware/fetchUser');
const nodemailer = require('nodemailer');

const JWT_SECTRET = 'dhruvdhruvdhruv';

// Create a User
const createUser = async (req, res) => {
    let success = false;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        let user = await User.findOne({ email: req.body.email });
        if (user) {
            return res.status(400).json({ error: "Sorry, a user with this email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const secPass = await bcrypt.hash(req.body.password, salt);

        user = await User.create({
            name: req.body.name,
            password: secPass,
            email: req.body.email,
            contact: req.body.contact,
        });

        const data = {
            user: {
                id: user.id,
            }
        };

        const authtoken = jwt.sign(data, JWT_SECTRET);
        success = true;
        res.json({ success, authtoken });
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Internal server Error");
    }
};

// Authenticate a User
const loginUser = async (req, res) => {
    let success = false;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Please try to login with correct credentials" });
        }
        const passwordCompare = await bcrypt.compare(password, user.password);
        if (!passwordCompare) {
            return res.status(400).json({ error: "Please try to login with correct credentials" });
        }
        const data = { user: { id: user.id, role: user.role } };
        const authtoken = jwt.sign(data, JWT_SECTRET);
        success = true;
        res.json({ success, authtoken });
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Internal server Error");
    }
};

// Get User Details
const getUser = async (req, res) => {
    try {
        let userId = req.user.id;
        const user = await User.findById(userId).select("-password");
        res.send(user);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Internal server Error");
    }
};

// Fetch all users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password"); // Exclude passwords
        res.json(users);
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Internal server error");
    }
};

// Add this route to fetch user details by ID
const getUserId = async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select("-password");
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      console.log("User fetched from DB:", user); // Log the fetched user data
      res.json(user);
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal server error");
    }
  };
  

// Forgot Password
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const now = new Date();
        const expiryDate = new Date(now.getTime() + 60000);
        const formattedExpiry = expiryDate.toTimeString().slice(0, 5);

        user.otp = otp;
        user.otpExpiry = formattedExpiry;
        await user.save();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'dhruvsheth01102003@gmail.com',
                pass: 'jhhozekydjsadaao'
            }
        });

        const mailOptions = {
            from: 'dhruvsheth01102003@gmail.com',
            to: email,
            subject: 'Reset Password from TastyFlow',
            text: `Your OTP is ${otp}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: 'Error sending email' });
            } else {
                res.status(200).json({ message: 'OTP sent successfully' });
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Verify OTP
const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const now = new Date();
        if (user.otpExpiry < now) {
            user.otp = undefined;
            user.otpExpiry = undefined;
            await user.save();
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();
        res.status(200).json({ message: 'OTP verified successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Reset Password
const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otp !== otp || user.otpExpiry < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

const addFoodToUser = async (req, res) => {
    const { userId } = req.params;  // User ID from params
    const { foods } = req.body;     // Array of food items and their quantities

    try {
        console.log("Adding food to user:", userId, foods); // Log incoming data for debugging

        const user = await User.findById(userId);  // Fetch user by userId
        if (!user) {
            console.error("User not found with ID:", userId);
            return res.status(404).json({ message: "User not found" }); // Ensure proper JSON response
        }

        // Loop through the foods array and update the selectedFoods for the user
        for (const food of foods) {
            // Fetch the full food data from the Food model using the foodId
            const foodItem = await Food.findById(food.foodId);
            if (!foodItem) {
                console.error("Food item not found:", food.foodId);
                return res.status(404).json({ message: `Food item with ID ${food.foodId} not found` }); // Proper JSON response
            }

            // Check if the food already exists in the user's selectedFoods
            const existingFood = user.selectedFoods.find((f) => f.food.toString() === food.foodId);

            if (existingFood) {
                // If the food item already exists, update the quantity
                existingFood.quantity += food.quantity;  // Add the new quantity to the existing one
            } else {
                // If the food doesn't exist, add the food item to the selectedFoods array
                user.selectedFoods.push({
                    food: food.foodId,   // Store foodId
                    quantity: food.quantity,  // Store the quantity
                    price: foodItem.price,  // Store the price from the Food model
                    name: foodItem.name    // Store the name from the Food model
                });
            }
        }

        // Save the user document after updating the selectedFoods
        await user.save();

        // Send a success message
        res.json({ message: "Foods added to user successfully" });  // Return success as JSON
    } catch (error) {
        console.error("Error adding food to user:", error.message); // Log error details
        res.status(500).json({ message: "Server error" });  // Return error as JSON
    }
};

  
  
  

module.exports = {
    createUser,
    loginUser,
    getUser,
    forgotPassword,
    verifyOtp,
    resetPassword,
    getAllUsers,
    getUserId,
    addFoodToUser
};
