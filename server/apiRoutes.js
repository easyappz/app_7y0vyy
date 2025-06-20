const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('./middleware/auth');
const User = require('./models/User');
const Classroom = require('./models/Classroom');
const Group = require('./models/Group');
const Schedule = require('./models/Schedule');
const Attendance = require('./models/Attendance');
const Payment = require('./models/Payment');
const Notification = require('./models/Notification');
const { generateToken, hashPassword, comparePassword, generateResetToken } = require('./utils/auth');
const { sendEmail } = require('./utils/email');

// Test Route
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from Prof-it API!' });
});

// Status Route
router.get('/status', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    app: 'Prof-it Backend'
  });
});

// Auth Routes
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone, address, adminKey } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    if (role === 'admin' && adminKey !== 'ilezhaniev') {
      return res.status(403).json({ message: 'Invalid admin key for registration' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await hashPassword(password);
    const isApproved = role === 'admin' ? true : false;

    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      phone,
      address,
      isApproved
    });

    await user.save();
    const token = generateToken(user);

    if (!isApproved) {
      const admins = await User.find({ role: 'admin', isApproved: true });
      admins.forEach(async (admin) => {
        const notification = new Notification({
          user: admin._id,
          title: 'New User Registration',
          message: `A new ${role} (${firstName} ${lastName}) is waiting for approval.`,
          type: 'general'
        });
        await notification.save();
      });
    }

    res.status(201).json({
      message: isApproved ? 'User registered successfully' : 'User registered, awaiting admin approval',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error during registration' });
  }
});

router.post('/auth/register-by-admin', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone, address } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await hashPassword(password);
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      phone,
      address,
      isApproved: true
    });

    await user.save();
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully by admin',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error during admin registration' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isApproved) {
      return res.status(403).json({ message: 'Account is not approved yet' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error during login' });
  }
});

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = generateResetToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const resetUrl = `http://your-frontend-domain.com/reset-password?token=${resetToken}`;
    const emailText = `You are receiving this because you (or someone else) have requested the reset of the password for your account.

` +
      `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:

` +
      `${resetUrl}

` +
      `If you did not request this, please ignore this email and your password will remain unchanged.`;

    const emailSent = await sendEmail(user.email, 'Password Reset - Prof-it Art School', emailText);
    if (!emailSent) {
      return res.status(500).json({ message: 'Error sending reset email' });
    }

    res.json({ message: 'Password reset email sent. Check your inbox for instructions.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error processing password reset request' });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

router.post('/auth/approve-user/:userId', protect, restrictTo('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isApproved) {
      return res.status(400).json({ message: 'User is already approved' });
    }

    user.isApproved = true;
    await user.save();

    const notification = new Notification({
      user: user._id,
      title: 'Account Approved',
      message: 'Your account has been approved. You can now log in.',
      type: 'general'
    });
    await notification.save();

    res.json({
      message: 'User approved successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error approving user' });
  }
});

router.get('/auth/pending-users', protect, restrictTo('admin'), async (req, res) => {
  try {
    const pendingUsers = await User.find({ isApproved: false }).select('-password');
    res.json({ pendingUsers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching pending users' });
  }
});

// User Routes
router.get('/users', protect, restrictTo('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

router.get('/users/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// Classroom Routes
router.post('/classrooms', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { name, capacity, description } = req.body;
    if (!name || !capacity) {
      return res.status(400).json({ message: 'Name and capacity are required' });
    }

    const classroom = new Classroom({ name, capacity, description });
    await classroom.save();
    res.status(201).json({ classroom });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating classroom' });
  }
});

router.get('/classrooms', protect, async (req, res) => {
  try {
    const classrooms = await Classroom.find();
    res.json({ classrooms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching classrooms' });
  }
});

// Group Routes
router.post('/groups', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { name, teacher, students, subject } = req.body;
    if (!name || !teacher || !subject) {
      return res.status(400).json({ message: 'Name, teacher, and subject are required' });
    }

    const group = new Group({ name, teacher, students: students || [], subject });
    await group.save();
    res.status(201).json({ group });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating group' });
  }
});

router.get('/groups', protect, async (req, res) => {
  try {
    const groups = await Group.find().populate('teacher students');
    res.json({ groups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching groups' });
  }
});

// Schedule Routes
router.post('/schedules', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { group, classroom, startTime, endTime, dayOfWeek } = req.body;
    if (!group || !classroom || !startTime || !endTime || !dayOfWeek) {
      return res.status(400).json({ message: 'All schedule details are required' });
    }

    const schedule = new Schedule({ group, classroom, startTime, endTime, dayOfWeek });
    await schedule.save();
    res.status(201).json({ schedule });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating schedule' });
  }
});

router.get('/schedules', protect, async (req, res) => {
  try {
    const schedules = await Schedule.find().populate('group classroom');
    res.json({ schedules });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching schedules' });
  }
});

// Attendance Routes
router.post('/attendances', protect, restrictTo('teacher', 'admin'), async (req, res) => {
  try {
    const { student, schedule, date, status, note } = req.body;
    if (!student || !schedule || !date || !status) {
      return res.status(400).json({ message: 'All attendance details are required' });
    }

    const attendance = new Attendance({ student, schedule, date, status, note });
    await attendance.save();
    res.status(201).json({ attendance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error recording attendance' });
  }
});

router.get('/attendances', protect, async (req, res) => {
  try {
    const attendances = await Attendance.find().populate('student schedule');
    res.json({ attendances });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching attendances' });
  }
});

// Payment Routes
router.post('/payments', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { student, amount, paymentDate, dueDate, status, description } = req.body;
    if (!student || !amount || !paymentDate || !dueDate) {
      return res.status(400).json({ message: 'All payment details are required' });
    }

    const payment = new Payment({ student, amount, paymentDate, dueDate, status: status || 'pending', description });
    await payment.save();

    // Create notification for payment
    if (status !== 'paid') {
      const notification = new Notification({
        user: student,
        title: 'Payment Due',
        message: `A payment of ${amount} is due by ${dueDate}.`,
        type: 'payment'
      });
      await notification.save();
    }

    res.status(201).json({ payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error recording payment' });
  }
});

router.get('/payments', protect, async (req, res) => {
  try {
    const payments = await Payment.find().populate('student');
    res.json({ payments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching payments' });
  }
});

// Notification Routes
router.get('/notifications', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id });
    res.json({ notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

router.patch('/notifications/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating notification' });
  }
});

module.exports = router;
