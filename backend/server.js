const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Connection - CHANGE YOUR PASSWORD HERE
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',  
    database: 'quickbit'
});

// Connect to database
db.connect((err) => {
    if (err) {
        console.log('❌ Database Connection Failed:', err);
        return;
    }
    console.log('✅ Connected to MySQL Database');
});

// ==================== USERS API ====================

// Register User - SEPARATE TABLES (User in users, Worker in workers ONLY)
app.post('/api/register', (req, res) => {
    const { name, email, password, phone, role, workerData } = req.body;
    
    console.log('Received data:', { name, email, role, workerData });
    
    if (role === 'user') {
        // USER goes to users table ONLY
        db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length > 0) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            
            db.query('INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
                [name, email, password, phone, 'user'], (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    console.log('✅ User inserted with ID:', result.insertId);
                    res.json({ success: true, userId: result.insertId, message: 'User registered successfully' });
                });
        });
    } 
    else if (role === 'worker') {
        // WORKER goes to workers table ONLY (NOT in users table)
        db.query('SELECT * FROM workers WHERE email = ?', [email], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length > 0) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            
            const profession = workerData?.profession || 'Cleaner';
            const experience = workerData?.experience || 1;
            const hourlyRate = workerData?.hourlyRate || 500;
            const skills = workerData?.skills || 'General';
            const gender = workerData?.gender || '';
            
            db.query(`INSERT INTO workers (name, email, password, phone, profession, experience, hourly_rate, skills, gender) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, email, password, phone, profession, experience, hourlyRate, skills, gender], 
                (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    console.log('✅ Worker inserted with ID:', result.insertId);
                    res.json({ success: true, userId: result.insertId, message: 'Worker registered successfully' });
                });
        });
    }
});
// Login User
app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;
    
    db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const user = users[0];
        
        // ========== ADD THIS LINE ↓↓↓ ==========
        if (!user.is_verified) {
            return res.status(401).json({ error: 'Please verify your email first. Check terminal for OTP.' });
        }
        // ======================================
        
        if (user.role !== role) {
            return res.status(401).json({ error: `You are registered as ${user.role}` });
        }
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    });
});

// ==================== WORKERS API ====================

// Get ALL workers (for find cleaners page)
app.get('/api/workers', (req, res) => {
    db.query('SELECT * FROM workers', (err, workers) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(workers);
    });
});

// Get single worker by ID
app.get('/api/workers/:id', (req, res) => {
    const { id } = req.params;
    
    db.query('SELECT * FROM workers WHERE id = ?', [id], (err, workers) => {
        if (err) return res.status(500).json({ error: err.message });
        if (workers.length === 0) return res.status(404).json({ error: 'Worker not found' });
        
        const worker = {
            ...workers[0],
            skills: workers[0].skills ? workers[0].skills.split(',') : []
        };
        
        res.json(worker);
    });
});

// Get worker earnings
app.get('/api/workers/:id/earnings', (req, res) => {
    const { id } = req.params;
    
    db.query(`SELECT SUM(amount) as total, COUNT(*) as jobs 
              FROM bookings WHERE worker_id = ? AND status = 'completed'`, 
        [id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ 
                total: result[0].total || 0, 
                jobs: result[0].jobs || 0 
            });
        });
});

// Update worker availability (online/offline)
app.put('/api/workers/:id/availability', (req, res) => {
    const { id } = req.params;
    const { available } = req.body;
    
    db.query('UPDATE workers SET available = ? WHERE id = ?', [available, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Update worker rating
app.put('/api/workers/:id/rating', (req, res) => {
    const { id } = req.params;
    const { rating } = req.body;
    
    db.query('UPDATE workers SET rating = ? WHERE id = ?', [rating, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
// ==================== SERVICES API ====================

// Get all services
app.get('/api/services', (req, res) => {
    db.query('SELECT * FROM services', (err, services) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(services);
    });
});

// ==================== BOOKINGS API ====================

// Create booking
app.post('/api/bookings', (req, res) => {
    const { userId, workerId, serviceName, amount, date, timeSlot, address } = req.body;
    const bookingId = 'BKG' + Date.now();
    
    db.query(`INSERT INTO bookings (booking_id, user_id, worker_id, service_name, amount, date, time_slot, address, status) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [bookingId, userId, workerId, serviceName, amount, date, timeSlot, address], 
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, bookingId });
        });
});

// Get user bookings
app.get('/api/bookings/user/:userId', (req, res) => {
    const { userId } = req.params;
    
    db.query(`SELECT b.*, w.name as worker_name 
              FROM bookings b 
              LEFT JOIN workers w ON b.worker_id = w.id 
              WHERE b.user_id = ? 
              ORDER BY b.created_at DESC`, 
        [userId], (err, bookings) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(bookings);
        });
});

// Get worker tasks
app.get('/api/bookings/worker/:workerId', (req, res) => {
    const { workerId } = req.params;
    
    db.query(`SELECT b.*, u.name as customer_name 
              FROM bookings b 
              JOIN users u ON b.user_id = u.id 
              WHERE b.worker_id = ? 
              ORDER BY b.created_at DESC`, 
        [workerId], (err, tasks) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(tasks);
        });
});

// Update booking status
app.put('/api/bookings/:bookingId/status', (req, res) => {
    const { bookingId } = req.params;
    const { status } = req.body;
    
    db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // If completed, update worker stats
        if (status === 'completed') {
            db.query('SELECT worker_id, amount FROM bookings WHERE id = ?', [bookingId], (err, booking) => {
                if (booking && booking[0]) {
                    const workerId = booking[0].worker_id;
                    db.query('UPDATE workers SET jobs = jobs + 1 WHERE id = ?', [workerId]);
                }
            });
        }
        
        res.json({ success: true });
    });
});

// Cancel booking
app.delete('/api/bookings/:bookingId', (req, res) => {
    const { bookingId } = req.params;
    
    db.query('UPDATE bookings SET status = "cancelled" WHERE id = ?', [bookingId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==================== REVIEWS API ====================

// Add review
app.post('/api/reviews', (req, res) => {
    const { bookingId, userId, workerId, rating, comment } = req.body;
    
    db.query('INSERT INTO reviews (booking_id, user_id, worker_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
        [bookingId, userId, workerId, rating, comment], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Update worker average rating
            db.query('SELECT AVG(rating) as avg FROM reviews WHERE worker_id = ?', [workerId], (err, result) => {
                const avgRating = result[0].avg;
                db.query('UPDATE workers SET rating = ? WHERE id = ?', [avgRating, workerId]);
            });
            
            res.json({ success: true });
        });
});

// Get worker reviews
app.get('/api/reviews/worker/:workerId', (req, res) => {
    const { workerId } = req.params;
    
    db.query(`SELECT r.*, u.name as user_name 
              FROM reviews r 
              JOIN users u ON r.user_id = u.id 
              WHERE r.worker_id = ? 
              ORDER BY r.created_at DESC`, 
        [workerId], (err, reviews) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(reviews);
        });
});

// ==================== DASHBOARD STATS ====================

// Get dashboard stats for user
app.get('/api/dashboard/user/:userId', (req, res) => {
    const { userId } = req.params;
    
    db.query(`SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as active,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as totalSpent
              FROM bookings WHERE user_id = ?`, 
        [userId], (err, stats) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(stats[0]);
        });
});

// Get dashboard stats for worker
app.get('/api/dashboard/worker/:workerId', (req, res) => {
    const { workerId } = req.params;
    
    db.query(`SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as earnings
              FROM bookings WHERE worker_id = ?`, 
        [workerId], (err, stats) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(stats[0]);
        });
});
// ============ GET PENDING BOOKINGS (for available jobs) ============
app.get('/api/bookings/pending', (req, res) => {
    db.query('SELECT * FROM bookings WHERE status = "pending" ORDER BY created_at DESC', (err, bookings) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(bookings);
    });
});
// ============ ADMIN API ENDPOINTS ============

// Get all users
app.get('/api/users', (req, res) => {
    db.query('SELECT * FROM users ORDER BY created_at DESC', (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(users);
    });
});

// Get all bookings (with user and worker names)
app.get('/api/bookings', (req, res) => {
    db.query(`SELECT b.*, u.name as user_name, w.name as worker_name 
              FROM bookings b 
              LEFT JOIN users u ON b.user_id = u.id 
              LEFT JOIN workers w ON b.worker_id = w.id 
              ORDER BY b.created_at DESC`, (err, bookings) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(bookings);
    });
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM users WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Delete worker
app.delete('/api/workers/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM workers WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==================== TEST ROUTE ====================

app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Quickbit API is running!',
        status: 'success',
        endpoints: [
            'POST /api/register',
            'POST /api/login',
            'GET /api/workers',
            'GET /api/services',
            'POST /api/bookings',
            'GET /api/bookings/user/:userId',
            'GET /api/bookings/worker/:workerId',
            'PUT /api/bookings/:bookingId/status',
            'POST /api/reviews'
        ]
    });
});
// ============ VERIFICATION SYSTEM ============

app.post('/api/send-otp', (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000);
    
    console.log(`📧 OTP for ${email}: ${otp}`);
    
    db.query('UPDATE users SET otp_code = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ?', 
        [otp, email], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
            
            // THIS LINE IS IMPORTANT - must have otp: otp
            res.json({ success: true, otp: otp });
        });
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    db.query('SELECT * FROM users WHERE email = ? AND otp_code = ? AND otp_expiry > NOW()', [email, otp], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        if (users.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });
        
        db.query('UPDATE users SET is_verified = TRUE, otp_code = NULL WHERE email = ?', [email]);
        res.json({ success: true, message: 'Email verified successfully' });
    });
});

// Get unverified users (for admin)
app.get('/api/unverified-users', (req, res) => {
    db.query('SELECT * FROM users WHERE is_verified = FALSE AND role = "user"', (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(users);
    });
});

// Admin approve/reject user
app.put('/api/verify-user/:userId', (req, res) => {
    const { userId } = req.params;
    const { approve } = req.body;
    
    if (approve) {
        db.query('UPDATE users SET is_verified = TRUE WHERE id = ?', [userId]);
    } else {
        db.query('DELETE FROM users WHERE id = ?', [userId]);
    }
    res.json({ success: true });
});
// ============ SOS ALERTS ============
app.post('/api/sos-alert', (req, res) => {
    const { workerId, latitude, longitude } = req.body;
    db.query('INSERT INTO sos_alerts (worker_id, latitude, longitude) VALUES (?, ?, ?)',
        [workerId, latitude, longitude], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.get('/api/sos-alerts', (req, res) => {
    db.query('SELECT * FROM sos_alerts ORDER BY created_at DESC', (err, alerts) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(alerts);
    });
});



// ==================== START SERVER ====================

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📡 Test API: http://localhost:${PORT}/api/test`);
    console.log(`👷 Workers API: http://localhost:${PORT}/api/workers`);
    console.log(`🔧 Services API: http://localhost:${PORT}/api/services\n`);
});