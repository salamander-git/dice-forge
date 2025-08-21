"use client";

export interface DiceTerm {
  type: 'dice';
  count: number;
  sides: number;
}

export interface NumberTerm {
  type: 'number';
  value: number;
}

export interface OperatorTerm {
    type: 'operator';
    value: '+' | '-' | '*' | '/';
}

export interface ParenthesisTerm {
    type: 'parenthesis';
    value: '(' | ')';
}

export type ParsedTerm = DiceTerm | NumberTerm | OperatorTerm | ParenthesisTerm;
export type CalculationTerm = DiceTerm | NumberTerm;

export interface RollDetail {
  value: number;
  sides: number;
  sign: 1 | -1;
}

export interface RollResult {
  total: number;
  details: RollDetail[];
  modifier: number;
}

// Tokenizer updated to handle parentheses
export const tokenizeFormula = (formula: string): ParsedTerm[] | null => {
    const cleanFormula = formula.replace(/\s+/g, '').toLowerCase();
    if (!cleanFormula) {
        return [];
    }

    const regex = /(\d+d\d+|\d+\.\d+|\d+|[+\-*/()])/g;
    let tokens: string[] = cleanFormula.match(regex) ?? [];
    const parsedTokens: ParsedTerm[] = [];

    // This lookbehind logic is tricky. Let's try a forward-looking approach for unary operators.
    const processedTokens: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const prevToken = i > 0 ? processedTokens[processedTokens.length - 1] : null;

        if ((token === '+' || token === '-') && (prevToken === null || ['(','+','-','*','/'].includes(prevToken))) {
            const nextToken = tokens[i+1];
            if (nextToken && (nextToken.match(/^\d/) || nextToken.match(/^\d+d\d+/))) {
                tokens[i+1] = token + nextToken;
                continue;
            }
        }
        processedTokens.push(token);
    }
    tokens = processedTokens;


    let openParens = 0;
    for (const token of tokens) {
        if (token === '(') openParens++;
        else if (token === ')') openParens--;
        if (openParens < 0) return null; // Mismatched parentheses

        if (token.match(/^\d+d\d+$/)) {
            const [countStr, sidesStr] = token.split('d');
            const count = countStr === '' ? 1 : parseInt(countStr);
            const sides = parseInt(sidesStr);
            if (isNaN(count) || isNaN(sides) || sides <= 0 || count <= 0) return null;
            parsedTokens.push({ type: 'dice', count, sides });
        } else if (token.match(/^-?\d+(\.\d+)?$/)) {
             parsedTokens.push({ type: 'number', value: parseFloat(token) });
        } else if (['+', '-', '*', '/'].includes(token)) {
            parsedTokens.push({ type: 'operator', value: token as '+' | '-' | '*' | '/' });
        } else if (['(', ')'].includes(token)) {
            parsedTokens.push({ type: 'parenthesis', value: token as '(' | ')' });
        } else if (token.match(/^-(\d+d\d+)$/)) { // Handle -1d6
            const [countStr, sidesStr] = token.substring(1).split('d');
            const count = countStr === '' ? 1 : parseInt(countStr);
            const sides = parseInt(sidesStr);
            if (isNaN(count) || isNaN(sides) || sides <= 0 || count <= 0) return null;
            parsedTokens.push({ type: 'number', value: -1 });
            parsedTokens.push({ type: 'operator', value: '*' });
            parsedTokens.push({ type: 'dice', count, sides });
        }
        else {
            return null; // Invalid token
        }
    }
    if (openParens !== 0) return null; // Mismatched parentheses

    return parsedTokens;
};


const precedence = {'+': 1, '-': 1, '*': 2, '/': 2};

const applyOp = (op: string, b: any, a: any, mode: 'dist' | 'value') => {
    if (mode === 'value') {
        switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return b === 0 ? NaN : a / b;
        }
    } else { // mode === 'dist'
        return combineDistributions(a, b, op as '+' | '-' | '*' | '/');
    }
    return NaN;
};


// Shunting-yard based evaluation
const evaluate = (tokens: ParsedTerm[], mode: 'min' | 'max' | 'avg' | 'roll' | 'dist') => {
    if (!tokens || tokens.length === 0) {
        return mode === 'dist' ? new Map([[0,1]]) : 0;
    }

    const values: any[] = [];
    const ops: string[] = [];

    const resolveTerm = (term: DiceTerm | NumberTerm) => {
        if (mode === 'dist') {
            return getTermDistribution(term);
        }
        if (term.type === 'number') return term.value;
        // DiceTerm
        switch(mode) {
            case 'min': return term.count * 1;
            case 'max': return term.count * term.sides;
            case 'avg': return term.count * (term.sides + 1) / 2;
            case 'roll':
                let sum = 0;
                for (let i = 0; i < term.count; i++) {
                    sum += Math.floor(Math.random() * term.sides) + 1;
                }
                return sum;
        }
        return 0;
    };
    
    const evaluationMode = mode === 'dist' ? 'dist' : 'value';

    for (const token of tokens) {
        if (token.type === 'number' || token.type === 'dice') {
            values.push(resolveTerm(token));
        } else if (token.type === 'parenthesis') {
            if (token.value === '(') {
                ops.push('(');
            } else { // ')'
                while (ops.length && ops[ops.length - 1] !== '(') {
                    const op = ops.pop()!;
                    const b = values.pop();
                    const a = values.pop();
                    values.push(applyOp(op, b, a, evaluationMode));
                }
                if (ops.length === 0) throw new Error("Mismatched parentheses");
                ops.pop(); // Pop '('.
            }
        } else { // Operator
            while (
                ops.length &&
                ops[ops.length - 1] !== '(' &&
                precedence[ops[ops.length - 1] as keyof typeof precedence] >= precedence[token.value]
            ) {
                const op = ops.pop()!;
                const b = values.pop();
                const a = values.pop();
                values.push(applyOp(op, b, a, evaluationMode));
            }
            ops.push(token.value);
        }
    }

    while (ops.length > 0) {
        const op = ops.pop()!;
        if (op === '(') throw new Error("Mismatched parentheses");
        const b = values.pop();
        const a = values.pop();
        values.push(applyOp(op, b, a, evaluationMode));
    }
    
    if (values.length !== 1) {
        // This case can happen with formulas like "2d6 3d6" (no operator)
        // or leading operators. The tokenizer should ideally prevent this.
        // For now, let's return the last computed value or a default.
        return values.length > 0 ? values[values.length - 1] : (mode === 'dist' ? new Map([[0,1]]) : 0);
    }
    
    return values[0];
};

export const parseDiceFormula = (formula: string): ParsedTerm[] | null => {
    try {
        const tokens = tokenizeFormula(formula);
        // Basic validation after tokenizing
        if (!tokens) return null;
        // Can add more validation here if needed, e.g. for consecutive operators/operands
        return tokens;
    } catch (e) {
        console.error("Parsing failed", e);
        return null;
    }
};

export const calculateStats = (terms: ParsedTerm[]) => {
  if (!terms || terms.length === 0) return { min: 0, max: 0, avg: 0, avgFloored: 0 };
  
  try {
    const min = evaluate(terms, 'min');
    const max = evaluate(terms, 'max');
    const avg = evaluate(terms, 'avg');
    return { min, max, avg, avgFloored: Math.floor(avg) };
  } catch(e) {
    console.error("Stat calculation error", e);
    return { min: 0, max: 0, avg: 0, avgFloored: 0 };
  }
};

export const simulateRoll = (terms: ParsedTerm[]): RollResult => {
    if (!terms || terms.length === 0) return { total: 0, details: [], modifier: 0 };
  
      const rollDetails: RollDetail[] = [];
      
      const rolledTerms: ParsedTerm[] = terms.map(term => {
          if (term.type === 'dice') {
              let totalRoll = 0;
              for (let i = 0; i < term.count; i++) {
                  const roll = Math.floor(Math.random() * term.sides) + 1;
                  totalRoll += roll;
                  rollDetails.push({value: roll, sides: term.sides, sign: 1});
              }
              return { type: 'number', value: totalRoll };
          }
          return term;
      });
  
      try {
        const total = evaluate(rolledTerms, 'roll');
        const modifier = terms
            .filter((t): t is NumberTerm => t.type === 'number')
            .reduce((sum, t) => sum + t.value, 0);

        return { total, details: rollDetails, modifier };
      } catch (e) {
         console.error("Roll simulation error", e);
         return { total: 0, details: [], modifier: 0 };
      }
  };


type Distribution = Map<number, number>;

const getTermDistribution = (term: DiceTerm | NumberTerm): Distribution => {
    const dist: Distribution = new Map();
    if (term.type === 'number') {
        dist.set(term.value, 1);
        return dist;
    }

    // DiceTerm
    let currentDist: Distribution = new Map([[0, 1]]);
    for (let i = 0; i < term.count; i++) {
        const nextDist: Distribution = new Map();
        for (let s = 1; s <= term.sides; s++) {
            for (const [sum, count] of currentDist.entries()) {
                const newSum = sum + s;
                nextDist.set(newSum, (nextDist.get(newSum) || 0) + count);
            }
        }
        currentDist = nextDist;
    }
    return currentDist;
};

const combineDistributions = (dist1: Distribution, dist2: Distribution, op: '+' | '-' | '*' | '/'): Distribution => {
    const newDist: Distribution = new Map();
    if (!dist1 || !dist2) return newDist;

    for (const [val1, count1] of dist1.entries()) {
        for (const [val2, count2] of dist2.entries()) {
            let newVal;
            switch (op) {
                case '+': newVal = val1 + val2; break;
                case '-': newVal = val1 - val2; break;
                case '*': newVal = val1 * val2; break;
                case '/': newVal = val2 === 0 ? NaN : val1 / val2; break;
            }
            if (!isNaN(newVal)) {
               // handle potential floating point issues by rounding to a reasonable precision
               const roundedVal = Math.round(newVal * 1e9) / 1e9;
               newDist.set(roundedVal, (newDist.get(roundedVal) || 0) + count1 * count2);
            }
        }
    }
    return newDist;
};

export const calculateProbabilityDistribution = (terms: ParsedTerm[]) => {
    if (!terms || terms.length === 0) return [];
    
    const totalDice = terms.reduce((sum, term) => term.type === 'dice' ? sum + term.count : sum, 0);
    if (totalDice > 8) { // Prevent performance issues with very complex formulas
        return [];
    }
    
    try {
        const finalDistribution = evaluate(terms, 'dist');
        if (!finalDistribution) return [];

        let totalCombinations = 0;
        for (const count of finalDistribution.values()) {
            totalCombinations += count;
        }

        if (totalCombinations === 0) return [];

        const result = Array.from(finalDistribution.entries())
            .map(([value, count]) => ({
                value,
                probability: count / totalCombinations,
            }))
            .filter(item => item.probability > 0)
            .sort((a, b) => a.value - b.value);

        return result;
    } catch (e) {
        console.error("Probability calculation error", e);
        return [];
    }
}
