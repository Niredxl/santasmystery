import { useState, useCallback } from 'react';

interface LMStudioMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface UseLMStudioOptions {
  baseUrl?: string;
  onError?: (error: Error) => void;
}

export function useLMStudio(options: UseLMStudioOptions = {}) {
  const { baseUrl = 'http://localhost:1234', onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const chat = useCallback(async (messages: LMStudioMessage[]): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          temperature: 0.7,
          max_tokens: 500,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`LM Studio error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, onError]);

  const generateRiddle = useCallback(async (word: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<string> => {
    const difficultyPrompts = {
      easy: 'Create a very simple riddle that almost gives away the answer. Use very direct hints.',
      medium: 'Create a moderately challenging riddle with clear but not obvious hints.',
      hard: 'Create a cryptic and challenging riddle with subtle, indirect hints.',
    };

    const messages: LMStudioMessage[] = [
      {
        role: 'system',
        content: `You are a Christmas elf who creates riddles for a guessing game. ${difficultyPrompts[difficulty]} The riddle should be festive and fun. Only output the riddle itself, nothing else. Keep it to 2-3 sentences maximum.`,
      },
      {
        role: 'user',
        content: `Create a riddle for the word: "${word}"`,
      },
    ];

    return chat(messages);
  }, [chat]);

  const evaluateGuess = useCallback(async (
    secretWord: string,
    guess: string,
    riddle: string
  ): Promise<{ isCorrect: boolean; response: string }> => {
    const messages: LMStudioMessage[] = [
      {
        role: 'system',
        content: `You are a friendly Christmas game host. The secret word is "${secretWord}". The riddle given was: "${riddle}". 
        
Evaluate if the player's guess is correct. Consider:
- Exact matches are definitely correct
- Very close variations (plurals, slight misspellings) should be accepted
- Synonyms or related words should be encouraged but marked as incorrect with a hint

Respond naturally and festively. If correct, celebrate! If wrong, give a gentle hint without revealing the answer. Keep your response brief (1-2 sentences).

IMPORTANT: At the start of your response, include [CORRECT] or [INCORRECT] to indicate the result, then your message.`,
      },
      {
        role: 'user',
        content: `The player guessed: "${guess}"`,
      },
    ];

    const response = await chat(messages);
    const isCorrect = response.includes('[CORRECT]');
    const cleanResponse = response.replace('[CORRECT]', '').replace('[INCORRECT]', '').trim();
    
    return { isCorrect, response: cleanResponse };
  }, [chat]);

  const generateHint = useCallback(async (
    secretWord: string,
    riddle: string,
    hintNumber: number
  ): Promise<string> => {
    const messages: LMStudioMessage[] = [
      {
        role: 'system',
        content: `You are a helpful Christmas elf giving hints for a word guessing game. The secret word is "${secretWord}". The original riddle was: "${riddle}". This is hint number ${hintNumber}.
        
Give a progressively more helpful hint. For hint 1, be subtle. For hint 2, be more direct. For hint 3+, give very strong hints without saying the word directly. Keep the hint to one sentence and make it festive!`,
      },
      {
        role: 'user',
        content: 'Give me a hint!',
      },
    ];

    return chat(messages);
  }, [chat]);

  // Handle any user input (questions or guesses)
  const handleUserInput = useCallback(async (
    secretWord: string,
    userInput: string,
    riddle: string
  ): Promise<{ isCorrect: boolean; response: string; isQuestion: boolean }> => {
    const messages: LMStudioMessage[] = [
      {
        role: 'system',
        content: `You are a friendly Christmas game host named Santa. The secret word is "${secretWord}". The riddle given was: "${riddle}". 

The player can either:
1. Ask questions about the riddle (e.g., "Is it something you eat?", "Is it red?", "Can you give me another clue?")
2. Make a guess at the answer

Determine if the input is a QUESTION or a GUESS:
- Questions typically start with "is", "are", "can", "does", "what", "how", "why", etc. or end with "?"
- Guesses are typically single words or short phrases stating an answer

If it's a QUESTION: Answer helpfully without revealing the secret word. You can say yes/no or give hints.
If it's a GUESS: Evaluate if correct. Consider exact matches, plurals, and close variations as correct.

IMPORTANT: Start your response with one of these tags:
- [QUESTION] if this is a question (then answer it)
- [CORRECT] if this is a correct guess (then celebrate!)
- [INCORRECT] if this is a wrong guess (then give encouragement)

Keep your response brief (1-2 sentences) and festive!`,
      },
      {
        role: 'user',
        content: userInput,
      },
    ];

    const response = await chat(messages);
    const isCorrect = response.includes('[CORRECT]');
    const isQuestion = response.includes('[QUESTION]');
    const cleanResponse = response
      .replace('[CORRECT]', '')
      .replace('[INCORRECT]', '')
      .replace('[QUESTION]', '')
      .trim();
    
    return { isCorrect, response: cleanResponse, isQuestion };
  }, [chat]);

  return {
    isLoading,
    error,
    chat,
    generateRiddle,
    evaluateGuess,
    generateHint,
    handleUserInput,
  };
}
