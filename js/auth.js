// js/auth.js
class Auth {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('users')) || [];
        this.workers = JSON.parse(localStorage.getItem('workers')) || [];
        this.bookings = JSON.parse(localStorage.getItem('bookings')) || [];
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        
        // Initialize with sample workers if empty
        this.initSampleData();
    }

    initSampleData() {
        // Add sample workers if none exist
        if (this.workers.length === 0) {
            const sampleWorkers = [
                {
                    id: 'WRK001',
                    userId: 'USR001',
                    name: 'Priya Sharma',
                    email: 'priya@worker.com',
                    phone: '9876543210',
                    profession: 'Cleaner',
                    experience: 5,
                    hourlyRate: 550,
                    skills: ['Deep Cleaning', 'Sanitization', 'Eco-friendly'],
                    rating: 4.9,
                    totalReviews: 128,
                    jobsCompleted: 150,
                    available: true,
                    verified: true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'WRK002',
                    userId: 'USR002',
                    name: 'Rahul Varma',
                    email: 'rahul@worker.com',
                    phone: '8765432109',
                    profession: 'Plumber',
                    experience: 3,
                    hourlyRate: 400,
                    skills: ['Pipe Repair', 'Leakage', 'Installation'],
                    rating: 4.8,
                    totalReviews: 89,
                    jobsCompleted: 97,
                    available: true,
                    verified: true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'WRK003',
                    userId: 'USR003',
                    name: 'Ananya Das',
                    email: 'ananya@worker.com',
                    phone: '7654321098',
                    profession: 'Housekeeping Specialist',
                    experience: 8,
                    hourlyRate: 750,
                    skills: ['Premium Care', 'Linen Care', 'Organization'],
                    rating: 5.0,
                    totalReviews: 256,
                    jobsCompleted: 320,
                    available: true,
                    verified: true,
                    createdAt: new Date().toISOString()
                }
            ];

            // Add corresponding users for these workers
            sampleWorkers.forEach(worker => {
                // Check if user already exists
                if (!this.users.find(u => u.id === worker.userId)) {
                    this.users.push({
                        id: worker.userId,
                        name: worker.name,
                        email: worker.email,
                        phone: worker.phone,
                        role: 'worker',
                        password: btoa('123456'),
                        status: 'active',
                        createdAt: worker.createdAt,
                        bookings: []
                    });
                }
                this.workers.push(worker);
            });

            localStorage.setItem('users', JSON.stringify(this.users));
            localStorage.setItem('workers', JSON.stringify(this.workers));
            console.log('✅ Sample workers added!');
        }
    }

    register(name, email, password, phone, role, workerData = null) {
        const userExists = this.users.find(user => user.email === email);
        if (userExists) {
            this.showToast('User already exists!', 'error');
            return false;
        }

        const userId = 'USR' + Date.now();
        const user = {
            id: userId,
            name,
            email,
            password: btoa(password),
            phone,
            role: role,
            status: 'active',
            createdAt: new Date().toISOString(),
            bookings: []
        };

        this.users.push(user);
        localStorage.setItem('users', JSON.stringify(this.users));
        
        if (role === 'worker' && workerData) {
            const worker = {
                id: 'WRK' + Date.now(),
                userId: userId,
                name: name,
                email: email,
                phone: phone,
                profession: workerData.profession,
                experience: workerData.experience,
                hourlyRate: workerData.hourlyRate,
                skills: workerData.skills || [],
                rating: 0,
                totalReviews: 0,
                jobsCompleted: 0,
                available: true,
                verified: false,
                createdAt: new Date().toISOString()
            };
            
            this.workers.push(worker);
            localStorage.setItem('workers', JSON.stringify(this.workers));
        }

        this.showToast('Registration successful! Please login.', 'success');
        return true;
    }

    login(email, password, role) {
        const user = this.users.find(u => u.email === email && u.password === btoa(password));
        
        if (user) {
            if (user.role !== role) {
                this.showToast(`Invalid role! You are registered as ${user.role}`, 'error');
                return false;
            }
            
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.showToast('Login successful!', 'success');
            return true;
        } else {
            this.showToast('Invalid email or password!', 'error');
            return false;
        }
    }

    getAllWorkers() {
        return this.workers.map(worker => {
            const user = this.users.find(u => u.id === worker.userId);
            return {
                ...worker,
                name: worker.name || user?.name,
                email: worker.email || user?.email,
                phone: worker.phone || user?.phone
            };
        });
    }

    getWorkerById(workerId) {
        const worker = this.workers.find(w => w.id === workerId);
        if (worker) {
            const user = this.users.find(u => u.id === worker.userId);
            return { ...worker, ...user };
        }
        return null;
    }

    getWorkerByUserId(userId) {
        return this.workers.find(w => w.userId === userId);
    }

    getBookings() {
        return JSON.parse(localStorage.getItem('bookings')) || [];
    }

    createBooking(bookingData) {
        const bookings = this.getBookings();
        const newBooking = {
            id: 'BKG' + Date.now(),
            ...bookingData,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        bookings.push(newBooking);
        localStorage.setItem('bookings', JSON.stringify(bookings));
        
        // Update user's bookings
        const user = this.users.find(u => u.id === bookingData.userId);
        if (user) {
            user.bookings.push(newBooking.id);
            localStorage.setItem('users', JSON.stringify(this.users));
        }
        
        return newBooking;
    }

    updateBookingStatus(bookingId, status, workerId = null) {
        const bookings = this.getBookings();
        const booking = bookings.find(b => b.id === bookingId);
        if (booking) {
            booking.status = status;
            if (workerId) booking.workerId = workerId;
            if (status === 'accepted') booking.acceptedAt = new Date().toISOString();
            if (status === 'completed') booking.completedAt = new Date().toISOString();
            localStorage.setItem('bookings', JSON.stringify(bookings));
            
            // Update worker stats if completed
            if (status === 'completed' && booking.workerId) {
                this.updateWorkerStats(booking.workerId, booking.totalAmount);
            }
            
            return true;
        }
        return false;
    }

    updateWorkerStats(workerId, amount) {
        const worker = this.workers.find(w => w.id === workerId);
        if (worker) {
            worker.jobsCompleted = (worker.jobsCompleted || 0) + 1;
            const earnings = JSON.parse(localStorage.getItem('earnings_' + workerId)) || { total: 0, pending: 0 };
            earnings.total += amount * 0.8;
            earnings.pending += amount * 0.8;
            localStorage.setItem('earnings_' + workerId, JSON.stringify(earnings));
            localStorage.setItem('workers', JSON.stringify(this.workers));
        }
    }

    getWorkerJobs(workerId) {
        const bookings = this.getBookings();
        return bookings.filter(b => b.workerId === workerId);
    }

    getPendingJobs() {
        const bookings = this.getBookings();
        return bookings.filter(b => b.status === 'pending');
    }

    getWorkerEarnings(workerId) {
        return JSON.parse(localStorage.getItem('earnings_' + workerId)) || { total: 0, pending: 0, today: 0, week: 0, month: 0 };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.showToast('Logged out successfully!', 'success');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

const auth = new Auth();