const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const router = express.Router();
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { User, Class, Subject, Unit, SubUnit, Lesson, Content } = require('../models.cjs');
const bcrypt = require('bcryptjs');

// ============================================================================
// CONSOLIDATED API ROUTES FOR VERCEL
// User-facing only - Admin functionality removed
// ============================================================================

// --- 1. User Login (POST) ---
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: 'Missing credentials'
            });
        }

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const passwordMatch = user.password === password;

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = `mock-token-${user._id}`;
        const { password: _, ...userWithoutPass } = user.toObject();
        res.json({ user: userWithoutPass, token });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// --- 1c. User Signup (POST) ---
router.post('/auth/signup', async (req, res) => {
    try {
        const { username, password, name, email, mobileNumber, role, class: userClass, schoolName, district, subDistrict } = req.body;

        if (!username || !password || !name || !email || !userClass || !schoolName || !district || !subDistrict || !mobileNumber) {
            return res.status(400).json({
                message: 'Missing required fields: All fields including School Name, District, and Sub-district are mandatory.'
            });
        }

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists' });
        }

        const newUser = new User({
            username,
            password,
            name,
            email,
            mobileNumber,
            class: userClass,
            schoolName,
            district,
            subDistrict,
            role: 'student',
            teacherRequestStatus: 'none',
            isFirstLogin: false,
            status: 'active'
        });

        await newUser.save();

        const token = `mock-token-${newUser._id}`;
        const { password: _, ...userWithoutPass } = newUser.toObject();

        res.status(201).json({ user: userWithoutPass, token, message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 1b. User Login (GET) ---
router.get('/auth/login', async (req, res) => {
    try {
        const username = req.query.username;
        let password = req.query.password;

        if (password && typeof password === 'string' && password.includes(':')) {
            password = password.split(':')[0];
        }

        if (!username || !password) {
            return res.status(400).json({
                message: 'Missing credentials'
            });
        }

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const passwordMatch = user.password === password;

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = `mock-token-${user._id}`;
        const { password: _, ...userWithoutPass } = user.toObject();
        res.json({ user: userWithoutPass, token });
    } catch (error) {
        res.status(500).json({
            message: 'Server error during login',
            error: error.message
        });
    }
});

// --- 2. Get Published Classes ---
router.get('/classes', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = { isPublished: true };
        const classes = await Class.find(query);
        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 3. Get Published Subjects ---
router.get('/subjects', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = { isPublished: true };
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
        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = { isPublished: true };
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
        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = { isPublished: true };
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
        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = { isPublished: true };
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

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
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

        if (populatedLesson) {
            return res.json({
                className: populatedLesson.subUnitId?.unitId?.subjectId?.classId?.name || '',
                subjectName: populatedLesson.subUnitId?.unitId?.subjectId?.name || '',
                unitName: populatedLesson.subUnitId?.unitId?.name || '',
                subUnitName: populatedLesson.subUnitId?.name || '',
                lessonName: populatedLesson.name || '',
                isPublished: populatedLesson.isPublished
            });
        }

        const populatedSubUnit = await SubUnit.findById(lessonId)
            .populate({
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
            });

        if (populatedSubUnit) {
            return res.json({
                className: populatedSubUnit.unitId?.subjectId?.classId?.name || '',
                subjectName: populatedSubUnit.unitId?.subjectId?.name || '',
                unitName: populatedSubUnit.unitId?.name || '',
                subUnitName: populatedSubUnit.name || '',
                lessonName: '',
                isPublished: populatedSubUnit.isPublished
            });
        }

        const populatedUnit = await Unit.findById(lessonId)
            .populate({
                path: 'subjectId',
                select: 'name classId',
                populate: {
                    path: 'classId',
                    select: 'name'
                }
            });

        if (populatedUnit) {
            return res.json({
                className: populatedUnit.subjectId?.classId?.name || '',
                subjectName: populatedUnit.subjectId?.name || '',
                unitName: populatedUnit.name || '',
                subUnitName: '',
                lessonName: '',
                isPublished: populatedUnit.isPublished
            });
        }

        return res.status(404).json({ message: 'Resource not found or incomplete hierarchy' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 8. Get Published Content ---
router.get('/content', async (req, res) => {
    try {
        const { lessonId, type } = req.query;

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const query = { isPublished: true };

        if (lessonId) {
            query.lessonId = new mongoose.Types.ObjectId(lessonId);
        }

        if (type) {
            query.type = type;
        }

        const contents = await Content.find(query);

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

        if (content.file?.url) {
            return res.redirect(content.file.url);
        }

        if (content.filePath && (content.filePath.startsWith('http://') || content.filePath.startsWith('https://'))) {
            return res.redirect(content.filePath);
        }

        if (content.body) {
            res.setHeader('Content-Type', 'application/pdf');
            return res.send(content.body);
        }

        return res.status(404).json({ message: 'File not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 10. Get User Profile ---
router.get('/users/:id/profile', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
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
        res.status(500).json({ message: error.message });
    }
});

// --- 11. Update User Profile ---
router.put('/users/:id/update-profile', async (req, res) => {
    try {
        const { name, email, mobileNumber, class: userClass, schoolName, district, subDistrict } = req.body;

        if (!name || !email) {
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

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: false }
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

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
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
        res.status(500).json({ message: error.message });
    }
});

// --- 13. View Count Tracking ---
router.post('/lessons/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;

        if (!type) {
            return res.status(400).json({ message: 'Resource type is required' });
        }

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const typeToField = {
            'book': 'bookViewCount',
            'worksheet': 'worksheetViewCount',
            'notes': 'notesViewCount',
            'qa': 'qaViewCount',
            'flashcard': 'flashcardViewCount',
            'video': 'videoViewCount',
            'audio': 'audioViewCount',
            'quiz': 'quizViewCount',
            'questionPaper': 'questionPaperViewCount',
            'slide': 'slideViewCount',
            'activity': 'activityViewCount',
            'worksheetPdf': 'worksheetPdfViewCount',
            'questionPaperPdf': 'questionPaperPdfViewCount'
        };

        const field = typeToField[type];
        if (!field) {
            return res.status(400).json({ message: 'Invalid resource type' });
        }

        const update = { $inc: { [field]: 1 } };
        const updatedLesson = await Lesson.findByIdAndUpdate(id, update, { new: true });

        if (!updatedLesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        res.json({ success: true, [field]: updatedLesson[field] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- 14. Content Item View Tracking ---
router.post('/content/:id/view', async (req, res) => {
    try {
        const { id } = req.params;

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/class_content_browser');
            } catch (dbError) {
                throw new Error(`Database connection failed: ${dbError.message}`);
            }
        }

        const updatedContent = await Content.findByIdAndUpdate(
            id,
            { $inc: { viewCount: 1 } },
            { new: true }
        );

        if (!updatedContent) {
            return res.status(404).json({ message: 'Content not found' });
        }

        res.json({ success: true, viewCount: updatedContent.viewCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
