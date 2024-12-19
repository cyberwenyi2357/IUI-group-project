import OpenAI from 'openai';

export const openai = new OpenAI({
    apiKey: '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',
    dangerouslyAllowBrowser: true
});


// OpenAI API provided by OhMyGPT.com for users who can not access the official OpenAI
// export const openai = new OpenAI({
//     // This is the free key (72h valid), but seems it does not work well.
//     // Seems a paid key works well.
//     apiKey: "sk-W1K9kJk08F74e5d317c4T3BlBkFJF6c5440c28364c169Faf",
//     baseURL: "https://api.ohmygpt.com/v1",
//     dangerouslyAllowBrowser: true
// })
