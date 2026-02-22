import mongoose from 'mongoose';

const uri = 'mongodb+srv://dsavio83_db_user:amhpj0609H@cluster0.kfyrhlx.mongodb.net/test?retryWrites=true&w=majority';

async function checkCounts() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const Lesson = mongoose.model('Lesson', new mongoose.Schema({}, { strict: false }));
        const Content = mongoose.model('Content', new mongoose.Schema({}, { strict: false }));

        const sampleLesson = await Lesson.findOne({});
        if (sampleLesson) {
            console.log('\nSample Lesson View Counts:');
            console.log('ID:', sampleLesson._id);
            console.log('Name:', sampleLesson.name);
            const counts = {};
            [
                'notesViewCount', 'qaViewCount', 'bookViewCount', 'slideViewCount',
                'videoViewCount', 'audioViewCount', 'flashcardViewCount',
                'worksheetViewCount', 'questionPaperViewCount', 'quizViewCount',
                'activityViewCount'
            ].forEach(field => {
                if (sampleLesson[field] !== undefined) counts[field] = sampleLesson[field];
                else counts[field] = 0;
            });
            console.log(JSON.stringify(counts, null, 2));
        }

        const sampleContent = await Content.findOne({ viewCount: { $gt: 0 } });
        if (sampleContent) {
            console.log('\nSample Content Item View Count:');
            console.log('ID:', sampleContent._id);
            console.log('Title:', sampleContent.title);
            console.log('Type:', sampleContent.type);
            console.log('View Count:', sampleContent.viewCount);
        } else {
            console.log('\nNo content items with viewCount > 0 found.');
            const anyContent = await Content.findOne({});
            if (anyContent) {
                console.log('Sample Content:', anyContent.title, 'View Count:', anyContent.viewCount);
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkCounts();
