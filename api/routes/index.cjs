const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs'); // Added fs
const router = express.Router();
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { User, Class, Subject, Unit, SubUnit, Lesson, Content } = require('../models.cjs');
const bcrypt = require('bcryptjs'); // Added bcrypt for password hashing
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Uploads (Cloudinary with Local Fallback)
let upload;

try {
    const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
        console.log('[API] Configuring Cloudinary storage...');
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        const storage = new CloudinaryStorage({
            cloudinary: cloudinary,
            params: {
                folder: 'class-content-browser',
                resource_type: 'auto',
                allowed_formats: ['jpg', 'png', 'pdf', 'mp4', 'mp3', 'webm', 'ogg', 'wav'],
                use_filename: true,
                unique_filename: true
            },
        });
        upload = multer({ storage: storage });
        console.log('[API] Cloudinary storage configured successfully');
    } else {
        throw new Error('Missing Cloudinary credentials');
    }
} catch (error) {
    console.warn('[API] Cloudinary configuration failed/missing:', error.message);
    console.log('[API] Falling back to local disk storage');

    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadsDir)
        },
        filename: function (req, file, cb) {
            // Sanitize filename
            const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            cb(null, Date.now() + '-' + safeName)
        }
    });
    upload = multer({
        storage: storage,
        limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
    });
}

// ============================================================================
// CONSOLIDATED API ROUTES FOR VERCEL (12 ENDPOINTS MAX)
// User-facing only - Admin functionality removed
// ============================================================================

// --- 1. User Login (POST) ---
router.post('/auth/login', async (req, res) => {
    try {
        console.log('=== LOGIN DEBUG (POST) ===');
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        console.log('Request body:', req.body);

        const { username, password } = req.body;
        console.log('Extracted credentials:', { username: username ? 'provided' : 'missing', password: password ? 'provided' : 'missing' });

        if (!username || !password) {
            console.log('Missing credentials - returning 400');
            return res.status(400).json({
                message: 'Missing credentials',
                received: { username: !!username, password: !!password },
                bodyParams: req.body
            });
        }

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (POST login) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        console.log('Searching for user with username:', username);
        const user = await User.findOne({ username });
        console.log('User search result:', user ? `Found user: ${user.username}` : 'No user found');

        if (!user) {
            console.log('User not found - returning 401');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log('Comparing passwords...');
        const passwordMatch = user.password === password;
        console.log('Password match result:', passwordMatch);

        if (!passwordMatch) {
            console.log('Password mismatch - returning 401');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = `mock-token-${user._id}`;
        const { password: _, ...userWithoutPass } = user.toObject();
        console.log('Login successful - returning 200');
        res.json({ user: userWithoutPass, token });
    } catch (error) {
        console.error('=== LOGIN ERROR (POST) ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            message: error.message,
            error: error.toString(),
            stack: error.stack
        });
    }
});

// --- 1c. User Signup (POST) ---
router.post('/auth/signup', async (req, res) => {
    try {
        console.log('=== SIGNUP DEBUG (POST) ===');
        const { username, password, name, email, mobileNumber, role, class: userClass, schoolName, district, subDistrict } = req.body;

        // Extended validation for new fields
        if (!username || !password || !name || !email || !userClass || !schoolName || !district || !subDistrict || !mobileNumber) {
            return res.status(400).json({
                message: 'Missing required fields: All fields including School Name, District, and Sub-district are mandatory.'
            });
        }

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (POST signup) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists' });
        }

        // Check for existing email too if needed, but keeping consistent with existing logic for now

        const newUser = new User({
            username,
            password, // Will be hashed by pre-save hook
            name,
            email,
            mobileNumber,
            class: userClass,
            schoolName,
            district,
            subDistrict,
            role: role || 'student',
            isFirstLogin: false, // Set to false since they just created their account/password
            status: 'active'
        });

        await newUser.save();

        const token = `mock-token-${newUser._id}`;
        const { password: _, ...userWithoutPass } = newUser.toObject();

        res.status(201).json({ user: userWithoutPass, token, message: 'User created successfully' });
    } catch (error) {
        console.error('=== SIGNUP ERROR ===', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 1b. User Login (GET with query parameters) ---
router.get('/auth/login', async (req, res) => {
    try {
        console.log('=== LOGIN DEBUG (GET) - ENHANCED ===');
        console.log('Timestamp:', new Date().toISOString());
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        console.log('Request query:', JSON.stringify(req.query, null, 2));
        console.log('Request headers:', JSON.stringify(req.headers, null, 2));

        // Enhanced parameter extraction and validation
        const username = req.query.username;
        let password = req.query.password;

        console.log('Raw parameters:', { username: username, password: password });

        // Handle potential password parsing issues (e.g., "student123:1")
        if (password && typeof password === 'string' && password.includes(':')) {
            console.log('Password contains colon - splitting on first colon');
            password = password.split(':')[0];
            console.log('Cleaned password:', password);
        }

        console.log('Extracted credentials:', {
            username: username ? 'provided' : 'missing',
            password: password ? 'provided' : 'missing'
        });

        if (!username || !password) {
            console.log('Missing credentials - returning 400');
            return res.status(400).json({
                message: 'Missing credentials',
                received: { username: !!username, password: !!password },
                queryParams: req.query,
                cleanedParams: { username: username, password: password }
            });
        }

        // Test database connection
        console.log('Testing database connection...');
        console.log('Mongoose connection state:', mongoose.connection.readyState);
        console.log('Mongoose connection states:', {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        }[mongoose.connection.readyState] || 'unknown');

        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        console.log('Searching for user with username:', username);
        const user = await User.findOne({ username });
        console.log('User search result:', user ? `Found user: ${user.username} (ID: ${user._id})` : 'No user found');

        if (!user) {
            console.log('User not found - returning 401');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log('Comparing passwords...');
        console.log('Stored password hash:', user.password);
        console.log('Provided password:', password);
        const passwordMatch = user.password === password;
        console.log('Password match result:', passwordMatch);

        if (!passwordMatch) {
            console.log('Password mismatch - returning 401');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = `mock-token-${user._id}`;
        const { password: _, ...userWithoutPass } = user.toObject();
        console.log('Login successful - returning 200');
        res.json({ user: userWithoutPass, token });
    } catch (error) {
        console.error('=== LOGIN ERROR (GET) - ENHANCED ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

        // Enhanced error response with debugging info
        res.status(500).json({
            message: 'Server error during login',
            error: error.message,
            errorName: error.name,
            stack: error.stack,
            requestInfo: {
                method: req.method,
                url: req.url,
                query: req.query,
                headers: {
                    'user-agent': req.headers['user-agent'],
                    'host': req.headers['host']
                }
            },
            mongooseState: mongoose.connection.readyState,
            timestamp: new Date().toISOString()
        });
    }
});

// --- 2. Get Published Classes ---
router.get('/classes', async (req, res) => {
    try {
        console.log('[API] GET /classes request received');
        console.log('Query params:', req.query);

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (GET /classes) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        console.log('Mongo Query:', JSON.stringify(query));
        const classes = await Class.find(query);
        console.log(`[API] Found ${classes.length} classes`);
        res.json(classes);
    } catch (error) {
        console.error('[API] Error in GET /classes:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 3. Get Published Subjects ---
router.get('/subjects', async (req, res) => {
    try {
        console.log('[API] GET /subjects request received');
        console.log('Query params:', req.query);

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (GET /subjects) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        if (req.query.classId) {
            query.classId = req.query.classId;
        }
        console.log('Mongo Query:', JSON.stringify(query));
        const subjects = await Subject.find(query);
        console.log(`[API] Found ${subjects.length} subjects`);
        res.json(subjects);
    } catch (error) {
        console.error('[API] Error in GET /subjects:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 4. Get Published Units ---
router.get('/units', async (req, res) => {
    try {
        console.log('[API] GET /units request received');
        console.log('Query params:', req.query);

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (GET /units) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        if (req.query.subjectId) {
            query.subjectId = req.query.subjectId;
        }
        const units = await Unit.find(query);
        console.log(`[API] Found ${units.length} units`);
        res.json(units);
    } catch (error) {
        console.error('[API] Error in GET /units:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 5. Get Published Sub-Units ---
router.get('/subUnits', async (req, res) => {
    try {
        console.log('[API] GET /subUnits request received');
        console.log('Query params:', req.query);

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (GET /subUnits) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        if (req.query.unitId) {
            query.unitId = req.query.unitId;
        }
        const subUnits = await SubUnit.find(query);
        console.log(`[API] Found ${subUnits.length} subUnits`);
        res.json(subUnits);
    } catch (error) {
        console.error('[API] Error in GET /subUnits:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 6. Get Published Lessons ---
router.get('/lessons', async (req, res) => {
    try {
        console.log('[API] GET /lessons request received');
        console.log('Query params:', req.query);

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (GET /lessons) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        if (req.query.subUnitId) {
            query.subUnitId = req.query.subUnitId;
        }
        const lessons = await Lesson.find(query);
        console.log(`[API] Found ${lessons.length} lessons`);
        res.json(lessons);
    } catch (error) {
        console.error('[API] Error in GET /lessons:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 7. Get Lesson Hierarchy Info ---
router.get('/hierarchy/:lessonId', async (req, res) => {
    try {
        const { lessonId } = req.params;

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (GET /hierarchy) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        if (!mongoose.Types.ObjectId.isValid(lessonId)) {
            return res.status(400).json({ message: 'Invalid lesson ID' });
        }

        const populatedLesson = await Lesson.findById(lessonId)
            .populate({
                path: 'subUnitId',
                select: 'name unitId',
                populate: {
                    path: 'unitId',
                    select: 'name subjectId',
                    populate: {
                        path: 'subjectId',
                        select: 'name classId',
                        populate: {
                            path: 'classId',
                            select: 'name'
                        }
                    }
                }
            });

        if (!populatedLesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        let className, subjectName, unitName, subUnitName, lessonName;

        if (populatedLesson?.subUnitId?.unitId?.subjectId?.classId?.name) {
            className = populatedLesson.subUnitId.unitId.subjectId.classId.name;
            subjectName = populatedLesson.subUnitId.unitId.subjectId.name;
            unitName = populatedLesson.subUnitId.unitId.name;
            subUnitName = populatedLesson.subUnitId.name;
            lessonName = populatedLesson.name;
        } else {
            return res.status(404).json({ message: 'Incomplete hierarchy' });
        }

        res.json({
            className,
            subjectName,
            unitName,
            subUnitName,
            lessonName,
            isPublished: populatedLesson.isPublished
        });

    } catch (error) {
        console.error('Error fetching hierarchy:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 8. Get Published Content ---
router.get('/content', async (req, res) => {
    try {
        const { lessonId, type } = req.query;

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (GET /content) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }

        if (lessonId) {
            query.lessonId = new mongoose.Types.ObjectId(lessonId);
        }

        if (type) {
            query.type = type;
        }

        const contents = await Content.find(query);

        // Return grouped format for consistency
        const grouped = contents.reduce((acc, content) => {
            if (!acc[content.type]) {
                acc[content.type] = { type: content.type, count: 0, docs: [] };
            }
            acc[content.type].docs.push(content);
            acc[content.type].count++;
            return acc;
        }, {});

        const result = Object.values(grouped);
        return res.json(result);
    } catch (error) {
        console.error('[API /content] Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 9. Serve Content Files ---
router.get('/content/:id/file', async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content) {
            return res.status(404).json({ message: 'Content not found' });
        }

        // Check if it's a Cloudinary URL or external URL
        if (content.file?.url) {
            return res.redirect(content.file.url);
        }

        if (content.filePath && (content.filePath.startsWith('http://') || content.filePath.startsWith('https://'))) {
            return res.redirect(content.filePath);
        }

        // For embedded content (base64, etc.)
        if (content.body) {
            res.setHeader('Content-Type', 'application/pdf');
            return res.send(content.body);
        }

        return res.status(404).json({ message: 'File not found' });
    } catch (error) {
        console.error('File serve error:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 10. Get User Profile ---
router.get('/users/:id/profile', async (req, res) => {
    try {
        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (GET profile) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            user: user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 11. Update User Profile ---
router.put('/users/:id/update-profile', async (req, res) => {
    try {
        console.log(`[API] PUT /users/${req.params.id}/update-profile`);
        console.log('Body:', req.body);
        const { name, email, mobileNumber, class: userClass, schoolName, district, subDistrict } = req.body;

        if (!name || !email) {
            console.warn('[API] Missing name or email');
            return res.status(400).json({
                message: 'Name and email are required'
            });
        }

        const updateData = { name, email };
        if (mobileNumber !== undefined) updateData.mobileNumber = mobileNumber;
        if (userClass !== undefined) updateData.class = userClass;
        if (schoolName !== undefined) updateData.schoolName = schoolName;
        if (district !== undefined) updateData.district = district;
        if (subDistrict !== undefined) updateData.subDistrict = subDistrict;

        console.log('[API] Update Data Prepared:', updateData);

        console.log('[API] Update Data Prepared:', updateData);

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (PUT update-profile) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        // Find user first to ensure existence
        const existingUser = await User.findById(req.params.id);
        if (!existingUser) {
            console.warn('[API] User not found for update:', req.params.id);
            return res.status(404).json({ message: 'User not found' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: false }
        ).select('-password');

        console.log('[API] Updated User Result:', updatedUser);

        console.log('[API] Profile updated successfully');
        res.json({
            success: true,
            user: updatedUser,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('[API] Profile update error:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 12. Change Password ---
router.put('/users/:id/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                message: 'Current password, new password, and confirm password are required'
            });
        }

        if (newPassword.length < 3) {
            return res.status(400).json({
                message: 'New password must be at least 3 characters long'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                message: 'New passwords do not match'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                message: 'New passwords do not match'
            });
        }

        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (PUT change-password) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.password !== currentPassword) {
            return res.status(401).json({
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- First-time login profile update (bonus endpoint, can be merged with #11 if needed) ---
router.put('/users/:id/profile', async (req, res) => {
    try {
        console.log(`[API] PUT /users/${req.params.id}/profile (First Time Login)`);
        console.log('Body:', req.body);
        const { password, mobileNumber } = req.body;

        if (!password || !mobileNumber) {
            console.warn('[API] Missing password or mobile number');
            return res.status(400).json({
                message: 'Password and mobile number are required'
            });
        }

        if (password.length < 3) {
            console.warn('[API] Password too short');
            return res.status(400).json({
                message: 'Password must be at least 3 characters long'
            });
        }



        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected (PUT first-time-profile) - attempting connection');
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
                console.log('Database connection established');
            } catch (dbError) {
                console.error('Database connection failed:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        // Check if user exists first
        const userExists = await User.exists({ _id: req.params.id });
        if (!userExists) {
            console.warn('[API] User not found for ID:', req.params.id);
            return res.status(404).json({ message: 'User not found' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            {
                password,
                mobileNumber,
                isFirstLogin: false
            },
            { new: true }
        ).select('-password');

        console.log('[API] First time login profile updated');
        res.json(updatedUser);
    } catch (error) {
        console.error('[API] Profile update error (First Time):', error);
        res.status(500).json({ message: error.message });
    }
});

// --- 13. Upload File (Admin) ---
// Use a wrapper to handle multer errors gracefully
router.post('/upload', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('[API] Multer Upload Error:', err);
            return res.status(500).json({
                message: 'File upload failed',
                error: err.message
            });
        }
        next();
    });
}, async (req, res) => {
    try {
        console.log('[API] POST /upload request received');

        if (!req.file) {
            console.error('No file uploaded in request');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('File uploaded:', req.file);
        const { lessonId, type, title } = req.body;

        if (!lessonId || !type || !title) {
            console.warn('Missing required fields: lessonId, type, or title');
            return res.status(400).json({ message: 'Missing required fields: lessonId, type, or title' });
        }

        // Determine if storage was Cloudinary or Local
        const isCloudinary = !!req.file.path.match(/cloudinary/i) || req.file.storage === 'cloudinary' || req.file.cloudinary;
        // Logic might need adjustment based on how multer-storage-cloudinary populates req.file
        // Typically req.file.path is the URL for Cloudinary.

        let fileData = {
            url: req.file.path,
            publicId: req.file.filename,
            size: req.file.size,
            mime: req.file.mimetype,
        };

        // If local, we might need to construct a URL
        if (!req.file.path.startsWith('http')) {
            // It's a local path
            // We need to serve this. The API serves /uploads via express.static in index.js
            // Local path: .../uploads/filename.ext
            // served at: /uploads/filename.ext
            const filename = req.file.filename;
            fileData.url = `/uploads/${filename}`;
        }

        // Create Content entry
        const contentData = {
            lessonId,
            type,
            title,
            storage: process.env.CLOUDINARY_CLOUD_NAME ? 'cloudinary' : 'local', // Assumption
            file: fileData,
            body: fileData.url, // Legacy support
            filePath: fileData.url, // Legacy support
            originalFileName: req.file.originalname,
            fileSize: req.file.size,
            isPublished: false
        };

        const newContent = new Content(contentData);
        await newContent.save();

        console.log('Content saved to DB:', newContent._id);

        res.json(newContent);
    } catch (error) {
        console.error('Upload API Error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
