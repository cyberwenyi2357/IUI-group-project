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
