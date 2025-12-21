const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const router = express.Router();
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { User, Class, Subject, Unit, SubUnit, Lesson, Content } = require('../models.cjs');

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
        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        const classes = await Class.find(query);
        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 3. Get Published Subjects ---
router.get('/subjects', async (req, res) => {
    try {
        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        if (req.query.classId) {
            query.classId = req.query.classId;
        }
        const subjects = await Subject.find(query);
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 4. Get Published Units ---
router.get('/units', async (req, res) => {
    try {
        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        if (req.query.subjectId) {
            query.subjectId = req.query.subjectId;
        }
        const units = await Unit.find(query);
        res.json(units);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 5. Get Published Sub-Units ---
router.get('/subUnits', async (req, res) => {
    try {
        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        if (req.query.unitId) {
            query.unitId = req.query.unitId;
        }
        const subUnits = await SubUnit.find(query);
        res.json(subUnits);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 6. Get Published Lessons ---
router.get('/lessons', async (req, res) => {
    try {
        const query = {};
        if (req.query.includeUnpublished !== 'true') {
            query.isPublished = true;
        }
        if (req.query.subUnitId) {
            query.subUnitId = req.query.subUnitId;
        }
        const lessons = await Lesson.find(query);
        res.json(lessons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 7. Get Lesson Hierarchy Info ---
router.get('/hierarchy/:lessonId', async (req, res) => {
    try {
        const { lessonId } = req.params;
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
        const { name, email, mobileNumber } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                message: 'Name and email are required'
            });
        }

        const updateData = { name, email };
        if (mobileNumber) {
            updateData.mobileNumber = mobileNumber;
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            user: updatedUser,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Profile update error:', error);
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
        const { password, mobileNumber } = req.body;

        if (!password || !mobileNumber) {
            return res.status(400).json({
                message: 'Password and mobile number are required'
            });
        }

        if (password.length < 3) {
            return res.status(400).json({
                message: 'Password must be at least 3 characters long'
            });
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

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
