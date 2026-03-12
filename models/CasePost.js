const mongoose = require('mongoose');

const casePostSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide a title for the case'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Please provide a description'],
        trim: true,
        maxlength: [2000, 'Description cannot be more than 2000 characters']
    },
    category: {
        type: String,
        required: [true, 'Please select a category'],
        enum: [
            'Family Law',
            'Criminal Law',
            'Corporate Law',
            'Intellectual Property',
            'Real Estate',
            'Immigration',
            'Employment',
            'Tax',
            'Bankruptcy',
            'Other'
        ]
    },
    budget: {
        type: Number,
        required: [true, 'Please provide a budget'],
        min: [0, 'Budget must be a positive number']
    },
    status: {
        type: String,
        enum: ['open', 'in-progress', 'completed', 'cancelled'],
        default: 'open'
    },
    client: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    acceptedBid: {
        type: mongoose.Schema.ObjectId,
        ref: 'Bid'
    },
    deadline: {
        type: Date,
        required: [true, 'Please provide a deadline']
    },
    location: {
        type: String,
        required: [true, 'Please provide a location']
    },
    isRemote: {
        type: Boolean,
        default: false
    },
    files: [{
        url: String,
        name: String,
        type: String
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual populate
casePostSchema.virtual('bids', {
    ref: 'Bid',
    localField: '_id',
    foreignField: 'casePost'
});

// Add indexes for better query performance
casePostSchema.index({ client: 1, status: 1 });
casePostSchema.index({ status: 1, category: 1 });

// Pre-save hook to ensure client is not a lawyer
casePostSchema.pre('save', async function(next) {
    const user = await this.model('User').findById(this.client);
    if (user.role !== 'client') {
        throw new Error('Only clients can post cases');
    }
    next();
});

module.exports = mongoose.model('CasePost', casePostSchema);
