const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: [true, 'Please provide a bid amount'],
        min: [0, 'Bid amount must be a positive number']
    },
    message: {
        type: String,
        required: [true, 'Please provide a message with your bid'],
        trim: true,
        maxlength: [1000, 'Message cannot be more than 1000 characters']
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
        default: 'pending'
    },
    lawyer: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    casePost: {
        type: mongoose.Schema.ObjectId,
        ref: 'CasePost',
        required: true
    },
    estimatedTime: {
        value: {
            type: Number,
            required: [true, 'Please provide an estimated time']
        },
        unit: {
            type: String,
            enum: ['hours', 'days', 'weeks', 'months'],
            required: [true, 'Please provide a time unit (hours, days, weeks, months)']
        }
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Prevent duplicate bids from same lawyer on same case
bidSchema.index({ lawyer: 1, casePost: 1 }, { unique: true });

// Add index for better query performance
bidSchema.index({ casePost: 1, status: 1 });
bidSchema.index({ lawyer: 1, status: 1 });

// Pre-save hook to ensure bidder is a lawyer
bidSchema.pre('save', async function(next) {
    const user = await this.model('User').findById(this.lawyer);
    if (user.role !== 'lawyer') {
        throw new Error('Only lawyers can place bids');
    }
    next();
});

// Static method to get average bid amount for a case
bidSchema.statics.getAverageBid = async function(casePostId) {
    const obj = await this.aggregate([
        {
            $match: { casePost: casePostId }
        },
        {
            $group: {
                _id: '$casePost',
                averageBid: { $avg: '$amount' },
                bidCount: { $sum: 1 }
            }
        }
    ]);

    try {
        await this.model('CasePost').findByIdAndUpdate(casePostId, {
            averageBid: obj[0] ? Math.ceil(obj[0].averageBid) : 0,
            bidCount: obj[0] ? obj[0].bidCount : 0
        });
    } catch (err) {
        console.error(err);
    }
};

// Call getAverageBid after save
bidSchema.post('save', function() {
    this.constructor.getAverageBid(this.casePost);
});

// Call getAverageBid after remove
bidSchema.post('remove', function() {
    this.constructor.getAverageBid(this.casePost);
});

module.exports = mongoose.model('Bid', bidSchema);
