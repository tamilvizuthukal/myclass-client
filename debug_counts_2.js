import mongoose from 'mongoose';

const uri = 'mongodb+srv://dsavio83_db_user:amhpj0609H@cluster0.kfyrhlx.mongodb.net/test?retryWrites=true&w=majority';

async function checkCounts() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const Lesson = mongoose.model('Lesson', new mongoose.Schema({}, { strict: false }));
        const Content = mongoose.model('Content', new mongoose.Schema({}, { strict: false }));

        const slide = await Content.findById('694aa56c942b92aafcf39ea2');
        if (slide) {
            console.log('\nSlide Details:');
            console.log('Title:', slide.title);
            console.log('View Count:', slide.viewCount);
            console.log('Lesson ID:', slide.lessonId);

            const lesson = await Lesson.findById(slide.lessonId);
            if (lesson) {
                console.log('\nLesson View Counts (Parent of Slide):');
                console.log('Name:', lesson.name);
                console.log('slideViewCount:', lesson.slideViewCount);
                console.log('Full View Counts:', JSON.stringify({
                    notes: lesson.notesViewCount,
                    qa: lesson.qaViewCount,
                    book: lesson.bookViewCount,
                    slide: lesson.slideViewCount,
                    video: lesson.videoViewCount,
                    audio: lesson.audioViewCount,
                    flashcard: lesson.flashcardViewCount,
                    worksheet: lesson.worksheetViewCount,
                    questionPaper: lesson.questionPaperViewCount,
                    quiz: lesson.quizViewCount,
                    activity: lesson.activityViewCount
                }, null, 2));
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkCounts();
