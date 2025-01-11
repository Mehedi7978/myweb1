require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Session Configuration
app.use(
  session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

// Schemas and Models
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
});

const blogSchema = new mongoose.Schema({
  title: String,
  content: String,
  thumbnail: String,
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  
});

const User = mongoose.model('User', userSchema);
const Blog = mongoose.model('Blog', blogSchema);

// Routes
app.get('/', async (req, res) => {
  const blogs = await Blog.find().populate('creator').sort({ createdAt: -1 });
  res.render('home', { blogs, session: req.session }); // Pass session explicitly
});  

app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.userId = user._id;
    req.session.username = user.username;
    res.redirect('/');
  } else {
    res.send('Invalid credentials');
  }
});

app.get('/signup', (req, res) => res.render('signup'));

app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.redirect('/login');
  } catch (error) {
    res.send('Email already in use. Please try another.');
  }
});

app.get('/new-post', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('post', { session: req.session });
});

app.post('/new-post', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { title, content, thumbnail } = req.body;
  const newPost = new Blog({
    title,
    content,
    thumbnail,
    creator: req.session.userId,
    
  });
  await newPost.save();
  res.redirect('/');
});

app.get('/profile', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findById(req.session.userId);
  const blogs = await Blog.find({ creator: req.session.userId });
  res.render('profile', { user, blogs, session: req.session });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Start Server
app.listen(1000, () => console.log('Server running on http://localhost:1000'));
