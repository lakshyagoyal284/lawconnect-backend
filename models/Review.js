const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    rating: {
        type: Number,
        required: [true, 'Please provide a rating'],
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: [true, 'Please provide a title for your review'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    comment: {
        type: String,
        required: [true, 'Please provide a comment'],
        trim: true,
        maxlength: [1000, 'Comment cannot be more than 1000 characters']
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
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
    isAnonymous: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Prevent duplicate reviews from same user for same lawyer and case
reviewSchema.index({ user: 1, lawyer: 1, casePost: 1 }, { unique: true });

// Static method to get average rating for a lawyer
reviewSchema.statics.getAverageRating = async function(lawyerId) {
    const obj = await this.aggregate([
        {
            $match: { lawyer: lawyerId }
        },
        {
            $group: {
                _id: '$lawyer',
                averageRating: { $avg: '$rating' },
                reviewCount: { $sum: 1 }
            }
        }
    ]);

    try {
        await this.model('User').findByIdAndUpdate(lawyerId, {
            averageRating: obj[0] ? obj[0].averageRating.toFixed(1) : 0,
            reviewCount: obj[0] ? obj[0].reviewCount : 0
        });
    } catch (err) {
        console.error(err);
    }
};

// Call getAverageRating after save
reviewSchema.post('save', function() {
    this.constructor.getAverageRating(this.lawyer);
});

// Call getAverageRating after remove
reviewSchema.post('remove', function() {
    this.constructor.getAverageRating(this.lawyer);
});

// Pre-save hook to ensure user is a client and has a completed case with the lawyer
reviewSchema.pre('save', async function(next) {
    const user = await this.model('User').findById(this.user);
    const casePost = await this.model('CasePost').findOne({
        _id: this.casePost,
        client: this.user,
        status: 'completed',
        acceptedBid: { $exists: true }
    }).populate({
        path: 'acceptedBid',
        match: { lawyer: this.lawyer }
    });

    if (user.role !== 'client') {
        throw new Error('Only clients can leave reviews');
    }

    if (!casePost || !casePost.acceptedBid) {
        throw new Error('You can only review lawyers you\'ve worked with on a completed case');
    }

    next();
});

module.exports = mongoose.model('Review', reviewSchema);
