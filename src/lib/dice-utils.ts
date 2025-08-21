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

export type ParsedTerm = DiceTerm | NumberTerm | OperatorTerm;
export type CalculationTerm = DiceTerm | NumberTerm;

export interface RollDetail {
  value: number;
  sides: number;
  sign: 1 | -1; // Kept for tooltip coloring, might need adjustment
}

export interface RollResult {
  total: number;
  details: RollDetail[];
  modifier: number;
}

// Improved tokenizer to handle dice, numbers, and operators including * and /
export const tokenizeFormula = (formula: string): ParsedTerm[] | null => {
    const cleanFormula = formula.replace(/\s+/g, '').toLowerCase();
    if (!cleanFormula) {
        return [];
    }
    
    // Add negative number support at the beginning of the formula
    const regex = /(\d+d\d+|\d+\.\d+|\d+|[+\-*/])/g;
    const tokens: string[] = cleanFormula.match(regex) ?? [];
    const parsedTokens: ParsedTerm[] = [];

    let expectOperand = true;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (['+', '-', '*', '/'].includes(token)) {
            // Handle unary minus or plus
            if (expectOperand && (token === '-' || token === '+')) {
                 if (i + 1 < tokens.length) {
                    const nextToken = tokens[i+1];
                    if (nextToken.match(/^\d/)) { // It's a number or dice
                        tokens[i+1] = token + nextToken;
                        continue;
                    }
                 }
            }
            if (expectOperand) return null; // two operators in a row
            parsedTokens.push({ type: 'operator', value: token as '+' | '-' | '*' | '/' });
            expectOperand = true;
        } else {
            if (!expectOperand) return null; // two operands in a row
             const sign = token.startsWith('-') ? -1 : 1;
             const unsignedToken = token.startsWith('-') || token.startsWith('+') ? token.substring(1) : token;

            if (unsignedToken.includes('d')) {
                const [countStr, sidesStr] = unsignedToken.split('d');
                const count = countStr === '' ? 1 : parseInt(countStr);
                const sides = parseInt(sidesStr);
                if (isNaN(count) || isNaN(sides) || sides <= 0 || count <= 0) return null;
                // For simplicity in evaluation, we'll treat the sign as part of the number later
                // Let's handle this by pushing a multiplication with -1 if needed
                 if (sign === -1) {
                    parsedTokens.push({ type: 'number', value: -1 });
                    parsedTokens.push({ type: 'operator', value: '*' });
                 }
                parsedTokens.push({ type: 'dice', count, sides });
            } else {
                const value = parseFloat(unsignedToken);
                if (isNaN(value)) return null;
                parsedTokens.push({ type: 'number', value: value * sign });
            }
            expectOperand = false;
        }
    }
    
    if (expectOperand && parsedTokens.length > 0) return null; // Ends with operator

    return parsedTokens;
};


// This is a simplified evaluation respecting order of operations.
// It doesn't use shunting-yard but processes in two passes.
const evaluateTerms = (terms: (CalculationTerm | number)[], isForStat: 'min' | 'max' | 'avg' | 'roll'): number => {
    const values = terms.map(term => {
        if (typeof term === 'number') return term;
        if (term.type === 'number') return term.value;

        // term is DiceTerm
        switch(isForStat) {
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
    });

    return values.reduce((acc, v) => acc + v, 0); // simple sum of resolved values
};

const processOperation = (stack: (number | string)[], operator: string) => {
    const right = stack.pop() as number;
    const left = stack.pop() as number;
    switch (operator) {
        case '*': stack.push(left * right); break;
        case '/': stack.push(left / right); break;
        case '+': stack.push(left + right); break;
        case '-': stack.push(left - right); break;
    }
}

const evaluateWithOrder = (tokens: ParsedTerm[], mode: 'min' | 'max' | 'avg' | 'roll'): number => {
    if (!tokens || tokens.length === 0) return 0;
    
    const precedence = {'+': 1, '-': 1, '*': 2, '/': 2};
    const values: number[] = [];
    const ops: ('+'|'-'|'*'|'/')[] = [];

    const resolveTerm = (term: DiceTerm | NumberTerm) => {
        if (term.type === 'number') return term.value;
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
    }

    const applyOps = () => {
        const op = ops.pop()!;
        const v2 = values.pop()!;
        const v1 = values.pop()!;
        switch (op) {
            case '+': values.push(v1 + v2); break;
            case '-': values.push(v1 - v2); break;
            case '*': values.push(v1 * v2); break;
            case '/': values.push(v1 / v2); break;
        }
    };

    for (const token of tokens) {
        if (token.type === 'number' || token.type === 'dice') {
            values.push(resolveTerm(token));
        } else { // Operator
            while(ops.length > 0 && precedence[ops[ops.length - 1]] >= precedence[token.value]) {
                applyOps();
            }
            ops.push(token.value);
        }
    }
    
    while(ops.length > 0) {
        applyOps();
    }

    return values[0];
}


export const parseDiceFormula = (formula: string): ParsedTerm[] | null => {
    try {
        return tokenizeFormula(formula);
    } catch (e) {
        return null;
    }
};

export const calculateStats = (terms: ParsedTerm[]) => {
  if (!terms || terms.length === 0) return { min: 0, max: 0, avg: 0, avgFloored: 0 };
  
  const min = evaluateWithOrder(terms, 'min');
  const max = evaluateWithOrder(terms, 'max');
  const avg = evaluateWithOrder(terms, 'avg');
  
  return { min, max, avg, avgFloored: Math.floor(avg) };
};

export const simulateRoll = (terms: ParsedTerm[]): RollResult => {
  if (!terms || terms.length === 0) return { total: 0, details: [], modifier: 0 };

    const rollDetails: RollDetail[] = [];
    
    const tokensWithRolledValues: ParsedTerm[] = terms.map(token => {
        if (token.type === 'dice') {
            let totalRoll = 0;
            for (let i = 0; i < token.count; i++) {
                const roll = Math.floor(Math.random() * token.sides) + 1;
                totalRoll += roll;
                rollDetails.push({value: roll, sides: token.sides, sign: 1}); // sign needs rethink
            }
            return { type: 'number', value: totalRoll };
        }
        return token;
    });
    
    let total = 0;
    
    if (tokensWithRolledValues.some(t => t.type === 'operator')) {
        total = evaluateWithOrder(tokensWithRolledValues, 'roll');
    } else {
        total = (tokensWithRolledValues[0] as NumberTerm)?.value || 0;
    }

    // Simplified details for now, as complex formulas are tricky
    // We can improve this later. The main goal is a correct total.
     const modifier = terms
        .filter((t): t is NumberTerm => t.type === 'number')
        .reduce((sum, t) => sum + t.value, 0);

  return { total, details: rollDetails, modifier };
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
    for (const [val1, count1] of dist1.entries()) {
        for (const [val2, count2] of dist2.entries()) {
            let newVal;
            switch (op) {
                case '+': newVal = val1 + val2; break;
                case '-': newVal = val1 - val2; break;
                case '*': newVal = val1 * val2; break;
                case '/': newVal = val2 === 0 ? Infinity : val1 / val2; break; // Handle division by zero
            }
            if (newVal !== Infinity) {
               newDist.set(newVal, (newDist.get(newVal) || 0) + count1 * count2);
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

    const precedence = {'+': 1, '-': 1, '*': 2, '/': 2};
    const values: Distribution[] = [];
    const ops: ('+'|'-'|'*'|'/')[] = [];

    const applyOps = () => {
        const op = ops.pop()!;
        const d2 = values.pop()!;
        const d1 = values.pop()!;
        values.push(combineDistributions(d1, d2, op));
    };

    for (const token of terms) {
        if (token.type === 'number' || token.type === 'dice') {
            values.push(getTermDistribution(token));
        } else { // Operator
            while(ops.length > 0 && precedence[ops[ops.length - 1]] >= precedence[token.value]) {
                applyOps();
            }
            ops.push(token.value);
        }
    }
    
    while(ops.length > 0) {
        applyOps();
    }

    const finalDistribution = values[0];
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
}
