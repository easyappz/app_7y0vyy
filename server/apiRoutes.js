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
const { generateToken, hashPassword, comparePassword } = require('./utils/auth');

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
      address
    });

    await user.save();
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error during registration' });
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

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error during login' });
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
