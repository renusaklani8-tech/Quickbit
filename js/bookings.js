// js/bookings.js - Updated with automatic earnings
class BookingSystem {
    constructor() {
        this.bookings = JSON.parse(localStorage.getItem('bookings')) || [];
        this.earnings = JSON.parse(localStorage.getItem('earnings')) || {
            total: 0,
            pending: 0,
            cleared: 0,
            today: 0,
            week: 0,
            month: 0,
            transactions: [],
            chartData: {
                mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0
            }
        };
    }

    createBooking(serviceDetails, cleaner, date, timeSlot, address) {
        const booking = {
            id: 'BKG' + Date.now() + Math.random().toString(36).substr(2, 5),
            userId: auth.currentUser?.id,
            userName: auth.currentUser?.name,
            service: serviceDetails,
            cleaner: cleaner,
            workerId: cleaner.id,
            workerName: cleaner.name,
            date: date,
            timeSlot: timeSlot,
            address: address,
            status: 'pending',
            createdAt: new Date().toISOString(),
            totalAmount: serviceDetails.price,
            paymentStatus: 'pending',
            completedAt: null
        };

        this.bookings.push(booking);
        localStorage.setItem('bookings', JSON.stringify(this.bookings));
        
        // Notify workers about new job
        this.notifyWorkers(booking);
        
        return booking;
    }

    // Worker accepts job
    acceptJob(bookingId, workerId) {
        const booking = this.bookings.find(b => b.id === bookingId);
        if (booking) {
            booking.status = 'accepted';
            booking.acceptedAt = new Date().toISOString();
            booking.workerId = workerId;
            localStorage.setItem('bookings', JSON.stringify(this.bookings));
            
            // Add notification
            this.addNotification({
                userId: booking.userId,
                message: `Your booking has been accepted by a worker`,
                type: 'booking_accepted'
            });
            
            return true;
        }
        return false;
    }

    // Worker starts job
    startJob(bookingId) {
        const booking = this.bookings.find(b => b.id === bookingId);
        if (booking) {
            booking.status = 'in-progress';
            booking.startedAt = new Date().toISOString();
            localStorage.setItem('bookings', JSON.stringify(this.bookings));
            
            this.addNotification({
                userId: booking.userId,
                message: `Worker has started your service`,
                type: 'job_started'
            });
            
            return true;
        }
        return false;
    }

    // Worker completes job - AUTOMATIC EARNINGS UPDATE
    completeJob(bookingId) {
        const booking = this.bookings.find(b => b.id === bookingId);
        if (booking) {
            booking.status = 'completed';
            booking.completedAt = new Date().toISOString();
            booking.paymentStatus = 'completed';
            
            // AUTO-CALCULATE EARNINGS
            const amount = booking.totalAmount;
            const workerEarning = amount * 0.8; // Worker gets 80%
            
            // Update worker's earnings automatically
            this.updateWorkerEarnings(booking.workerId, workerEarning, booking);
            
            localStorage.setItem('bookings', JSON.stringify(this.bookings));
            
            // Notify user
            this.addNotification({
                userId: booking.userId,
                message: `Your service is completed! Rate your experience`,
                type: 'job_completed'
            });
            
            return true;
        }
        return false;
    }

    // AUTO-UPDATE EARNINGS
    updateWorkerEarnings(workerId, amount, booking) {
        let earnings = JSON.parse(localStorage.getItem('earnings_' + workerId)) || {
            total: 0,
            pending: 0,
            cleared: 0,
            today: 0,
            week: 0,
            month: 0,
            transactions: [],
            chartData: {
                mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0
            }
        };
        
        // Update totals
        earnings.total += amount;
        earnings.pending += amount; // Pending until withdrawal
        
        // Update today's earnings
        const today = new Date().toDateString();
        if (localStorage.getItem('lastEarningDate') === today) {
            earnings.today += amount;
        } else {
            earnings.today = amount;
            localStorage.setItem('lastEarningDate', today);
        }
        
        // Update week
        earnings.week += amount;
        
        // Update month
        earnings.month += amount;
        
        // Update chart data based on day
        const day = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        earnings.chartData[day] = (earnings.chartData[day] || 0) + amount;
        
        // Add transaction
        earnings.transactions.unshift({
            id: Date.now(),
            service: booking.service.name,
            customer: booking.userName,
            amount: amount,
            type: 'credit',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            status: 'pending',
            bookingId: booking.id
        });
        
        localStorage.setItem('earnings_' + workerId, JSON.stringify(earnings));
        
        // Auto-send notification to worker
        this.addNotification({
            userId: workerId,
            message: `You earned ₹${amount} for completing ${booking.service.name}`,
            type: 'earnings_updated'
        });
    }

    // Process withdrawal
    processWithdrawal(workerId, amount, method) {
        const earnings = JSON.parse(localStorage.getItem('earnings_' + workerId));
        
        if (earnings && earnings.pending >= amount) {
            earnings.pending -= amount;
            earnings.cleared += amount;
            
            // Add withdrawal transaction
            earnings.transactions.unshift({
                id: Date.now(),
                type: 'debit',
                amount: amount,
                method: method,
                status: 'processed',
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString()
            });
            
            localStorage.setItem('earnings_' + workerId, JSON.stringify(earnings));
            
            this.addNotification({
                userId: workerId,
                message: `Withdrawal of ₹${amount} processed successfully`,
                type: 'withdrawal'
            });
            
            return true;
        }
        return false;
    }

    // Get worker earnings
    getWorkerEarnings(workerId) {
        return JSON.parse(localStorage.getItem('earnings_' + workerId)) || {
            total: 0,
            pending: 0,
            cleared: 0,
            today: 0,
            week: 0,
            month: 0,
            transactions: [],
            chartData: {mon:0, tue:0, wed:0, thu:0, fri:0, sat:0, sun:0}
        };
    }

    // Get available jobs for workers
    getAvailableJobs() {
        return this.bookings.filter(b => b.status === 'pending');
    }

    // Get worker's jobs
    getWorkerJobs(workerId) {
        return this.bookings.filter(b => b.workerId === workerId);
    }

    addNotification(notification) {
        let notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        notifications.unshift({
            id: Date.now(),
            ...notification,
            read: false,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem('notifications', JSON.stringify(notifications));
    }

    getNotifications(userId) {
        const notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        return notifications.filter(n => n.userId === userId);
    }
}

const bookingSystem = new BookingSystem();