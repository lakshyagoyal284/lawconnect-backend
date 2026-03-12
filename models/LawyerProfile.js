const mongoose = require('mongoose');

const lawyerProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    bio: {
        type: String,
        trim: true,
        maxlength: [2000, 'Bio cannot be more than 2000 characters']
    },
    specializations: [{
        type: String,
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
    }],
    experience: {
        type: Number,
        min: [0, 'Experience cannot be negative']
    },
    education: [{
        degree: {
            type: String,
            required: [true, 'Please provide a degree'],
            trim: true
        },
        institution: {
            type: String,
            required: [true, 'Please provide an institution'],
            trim: true
        },
        fieldOfStudy: {
            type: String,
            required: [true, 'Please provide a field of study'],
            trim: true
        },
        from: {
            type: Date,
            required: [true, 'Please provide a start date']
        },
        to: {
            type: Date
        },
        current: {
            type: Boolean,
            default: false
        },
        description: {
            type: String,
            trim: true
        }
    }],
    license: {
        number: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        verified: {
            type: Boolean,
            default: false
        }
    },
    languages: [{
        language: {
            type: String,
            required: [true, 'Please provide a language'],
            trim: true
        },
        proficiency: {
            type: String,
            enum: ['Basic', 'Conversational', 'Fluent', 'Native'],
            default: 'Basic'
        }
    }],
    hourlyRate: {
        type: Number,
        min: [0, 'Hourly rate cannot be negative']
    },
    location: {
        address: {
            type: String,
            trim: true
        },
        city: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        country: {
            type: String,
            trim: true
        },
        zipCode: {
            type: String,
            trim: true
        },
        coordinates: {
            type: [Number],  // [longitude, latitude]
            index: '2dsphere'
        }
    },
    availability: {
        monday: {
            type: Boolean,
            default: false
        },
        tuesday: {
            type: Boolean,
            default: false
        },
        wednesday: {
            type: Boolean,
            default: false
        },
        thursday: {
            type: Boolean,
            default: false
        },
        friday: {
            type: Boolean,
            default: false
        },
        saturday: {
            type: Boolean,
            default: false
        },
        sunday: {
            type: Boolean,
            default: false
        },
        timeSlots: [{
            day: {
                type: String,
                enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            },
            startTime: String,  // Format: "HH:MM"
            endTime: String     // Format: "HH:MM"
        }]
    },
    social: {
        website: {
            type: String,
            trim: true
        },
        linkedin: {
            type: String,
            trim: true
        },
        twitter: {
            type: String,
            trim: true
        },
        facebook: {
            type: String,
            trim: true
        },
        instagram: {
            type: String,
            trim: true
        }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    consultationFee: {
        type: Number,
        default: 0
    },
    paymentMethods: [{
        type: String,
        enum: ['credit_card', 'paypal', 'bank_transfer', 'crypto']
    }],
    ratingsAverage: {
        type: Number,
        default: 0,
        min: [0, 'Rating must be at least 0'],
        max: [5, 'Rating cannot be more than 5'],
        set: val => Math.round(val * 10) / 10 // 4.666666, 46.6666, 47, 4.7
    },
    ratingsQuantity: {
        type: Number,
        default: 0
    },
    completedCases: {
        type: Number,
        default: 0
    },
    responseTime: {
        type: Number, // in hours
        default: 24
    },
    isProfileComplete: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual populate for reviews
lawyerProfileSchema.virtual('reviews', {
    ref: 'Review',
    foreignField: 'lawyer',
    localField: 'user'
});

// Virtual populate for cases
lawyerProfileSchema.virtual('cases', {
    ref: 'CasePost',
    foreignField: 'acceptedBid',
    localField: 'user'
});

// Index for text search
lawyerProfileSchema.index({
    bio: 'text',
    'education.institution': 'text',
    'education.fieldOfStudy': 'text',
    specializations: 'text'
});

// Pre-save hook to ensure user is a lawyer
lawyerProfileSchema.pre('save', async function(next) {
    const user = await this.model('User').findById(this.user);
    if (user.role !== 'lawyer') {
        throw new Error('Only lawyers can have a lawyer profile');
    }
    
    // Check if profile is complete
    this.isProfileComplete = this.bio && 
                           this.specializations && this.specializations.length > 0 && 
                           this.experience !== undefined && 
                           this.education && this.education.length > 0 && 
                           this.languages && this.languages.length > 0;
    
    next();
});

// Update user's average rating when a review is saved or removed
lawyerProfileSchema.post('save', function(doc) {
    this.constructor.calcAverageRating(this.user);
});

lawyerProfileSchema.post('remove', function(doc) {
    this.constructor.calcAverageRating(this.user);
});

// Static method to calculate average rating
lawyerProfileSchema.statics.calcAverageRating = async function(userId) {
    const stats = await this.aggregate([
        {
            $match: { user: userId }
        },
        {
            $lookup: {
                from: 'reviews',
                localField: 'user',
                foreignField: 'lawyer',
                as: 'reviews'
            }
        },
        {
            $unwind: '$reviews'
        },
        {
            $group: {
                _id: '$user',
                nRating: { $sum: 1 },
                avgRating: { $avg: '$reviews.rating' }
            }
        }
    ]);

    if (stats.length > 0) {
        await this.model('LawyerProfile').findOneAndUpdate(
            { user: userId },
            {
                ratingsQuantity: stats[0].nRating,
                ratingsAverage: stats[0].avgRating
            }
        );
    } else {
        await this.model('LawyerProfile').findOneAndUpdate(
            { user: userId },
            {
                ratingsQuantity: 0,
                ratingsAverage: 0
            }
        );
    }
};

module.exports = mongoose.model('LawyerProfile', lawyerProfileSchema);
