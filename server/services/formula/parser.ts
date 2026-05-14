/**
 * Chart Formula Parser
 * 
 * Parses Kiwoom-style chart formulas into AST (Abstract Syntax Tree)
 * Example: CL=valuewhen((highest(h(1).period)<highest(h.period)),((highest(high)-highest(H, period)-((highest(H, period)-CL)/5)+5))
 * 
 * Supported functions:
 * - highest(field, period): Maximum value over period
 * - lowest(field, period): Minimum value over period
 * - valuewhen(condition, value): Return value when condition is true
 * - h(offset): High price at offset
 * - l(offset): Low price at offset
 * - c(offset): Close price at offset
 * - o(offset): Open price at offset
 * - v(offset): Volume at offset
 */

export interface FormulaAST {
  type: 'assignment' | 'function' | 'operator' | 'identifier' | 'number' | 'comparison';
  value?: string | number;
  name?: string;
  left?: FormulaAST;
  right?: FormulaAST;
  args?: FormulaAST[];
  operator?: string;
}

export class FormulaParser {
  private tokens: string[] = [];
  private position: number = 0;

  /**
   * Parse a formula string into AST
   */
  parse(formula: string): FormulaAST {
    this.tokens = this.tokenize(formula);
    this.position = 0;
    return this.parseExpression();
  }

  /**
   * Tokenize formula into array of tokens
   */
  private tokenize(formula: string): string[] {
    const tokens: string[] = [];
    let current = '';
    
    for (let i = 0; i < formula.length; i++) {
      const char = formula[i];
      
      if (char === ' ') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      
      if ('()[]{}=<>+-*/,'.includes(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }
    
    if (current) {
      tokens.push(current);
    }
    
    return tokens;
  }

  /**
   * Parse expression
   */
  private parseExpression(): FormulaAST {
    // Check for assignment (variable = value)
    if (this.peek(1) === '=') {
      const identifier = this.consume();
      this.consume(); // consume '='
      const value = this.parseExpression();
      
      return {
        type: 'assignment',
        name: identifier,
        right: value,
      };
    }
    
    return this.parseComparison();
  }

  /**
   * Parse comparison operations (<, >, <=, >=, ==, !=)
   */
  private parseComparison(): FormulaAST {
    let left = this.parseAdditive();
    
    while (this.peek() && ['<', '>', '<=', '>=', '==', '!='].includes(this.peek())) {
      const operator = this.consume();
      const right = this.parseAdditive();
      
      left = {
        type: 'comparison',
        operator,
        left,
        right,
      };
    }
    
    return left;
  }

  /**
   * Parse additive operations (+, -)
   */
  private parseAdditive(): FormulaAST {
    let left = this.parseMultiplicative();
    
    while (this.peek() && ['+', '-'].includes(this.peek())) {
      const operator = this.consume();
      const right = this.parseMultiplicative();
      
      left = {
        type: 'operator',
        operator,
        left,
        right,
      };
    }
    
    return left;
  }

  /**
   * Parse multiplicative operations (*, /)
   */
  private parseMultiplicative(): FormulaAST {
    let left = this.parsePrimary();
    
    while (this.peek() && ['*', '/'].includes(this.peek())) {
      const operator = this.consume();
      const right = this.parsePrimary();
      
      left = {
        type: 'operator',
        operator,
        left,
        right,
      };
    }
    
    return left;
  }

  /**
   * Parse primary expressions (numbers, identifiers, functions, parentheses)
   */
  private parsePrimary(): FormulaAST {
    const token = this.peek();
    
    if (!token) {
      throw new Error('Unexpected end of formula');
    }
    
    // Parentheses
    if (token === '(') {
      this.consume(); // consume '('
      const expr = this.parseExpression();
      if (this.peek() !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      this.consume(); // consume ')'
      return expr;
    }
    
    // Numbers
    if (/^-?\d+(\.\d+)?$/.test(token)) {
      this.consume();
      return {
        type: 'number',
        value: parseFloat(token),
      };
    }
    
    // Functions or identifiers
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      const name = this.consume();
      
      // Function call
      if (this.peek() === '(') {
        this.consume(); // consume '('
        const args: FormulaAST[] = [];
        
        while (this.peek() !== ')') {
          args.push(this.parseExpression());
          
          if (this.peek() === ',') {
            this.consume();
          } else if (this.peek() !== ')') {
            throw new Error('Expected comma or closing parenthesis');
          }
        }
        
        this.consume(); // consume ')'
        
        return {
          type: 'function',
          name,
          args,
        };
      }
      
      // Simple identifier
      return {
        type: 'identifier',
        name,
      };
    }
    
    throw new Error(`Unexpected token: ${token}`);
  }

  /**
   * Peek at current token without consuming
   */
  private peek(offset: number = 0): string {
    return this.tokens[this.position + offset] || '';
  }

  /**
   * Consume current token and advance
   */
  private consume(): string {
    return this.tokens[this.position++] || '';
  }
}

/**
 * Parse a formula string into AST
 */
export function parseFormula(formula: string): FormulaAST {
  const parser = new FormulaParser();
  return parser.parse(formula);
}

/**
 * Convert AST back to string (for debugging)
 */
export function astToString(ast: FormulaAST): string {
  switch (ast.type) {
    case 'assignment':
      return `${ast.name} = ${astToString(ast.right!)}`;
    
    case 'function':
      const args = ast.args?.map(astToString).join(', ') || '';
      return `${ast.name}(${args})`;
    
    case 'operator':
      return `(${astToString(ast.left!)} ${ast.operator} ${astToString(ast.right!)})`;
    
    case 'comparison':
      return `(${astToString(ast.left!)} ${ast.operator} ${astToString(ast.right!)})`;
    
    case 'identifier':
      return ast.name || '';
    
    case 'number':
      return String(ast.value);
    
    default:
      return '';
  }
}
