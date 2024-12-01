import { openai } from './openai';

export const getEmbedding = async (text: string) => {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float"
        });

        const embedding = response.data[0].embedding;
        console.log('Embedding generated:', embedding.length);
        return embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        return null;
    }
};
export const extractKeywords = async (text: string) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
                role: "system",
                content: "Extract the most salient word or phrase from the given text. Return only the word or phrase."
            }, {
                role: "user",
                content: text
            }],
            temperature: 0.3,
        });

        return response.choices[0].message.content;
        
    } catch (error) {
        console.error('Error extracting keywords:', error);
    }
};
export const segmentAndSummarize = async (text: string) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
                role: "system",
                content: "Segment the given transcription, and give me the last segment."
            }, {
                role: "user",
                content: text
            }],
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error segmenting transcription:', error);
    }
}
