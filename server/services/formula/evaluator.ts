/**
 * Chart Formula Evaluator
 * 
 * Evaluates parsed formulas against OHLCV (Open, High, Low, Close, Volume) data
 * to generate 7-color signal lines for buy/sell indicators
 */

import type { FormulaAST } from './parser';

export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalLine {
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'violet';
  name: string;
  values: Array<{ date: string; value: number }>;
}

export interface EvaluationContext {
  data: OHLCVData[];
  currentIndex: number;
  variables: Record<string, number>;
}

export class FormulaEvaluator {
  /**
   * Evaluate formula against OHLCV data
   */
  evaluate(ast: FormulaAST, data: OHLCVData[]): number[] {
    const results: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const context: EvaluationContext = {
        data,
        currentIndex: i,
        variables: {},
      };
      
      try {
        const value = this.evaluateNode(ast, context);
        results.push(value);
      } catch (error) {
        results.push(NaN);
      }
    }
    
    return results;
  }

  /**
   * Evaluate AST node recursively
   */
  private evaluateNode(node: FormulaAST, context: EvaluationContext): number {
    switch (node.type) {
      case 'assignment':
        const value = this.evaluateNode(node.right!, context);
        context.variables[node.name!] = value;
        return value;
      
      case 'number':
        return node.value as number;
      
      case 'identifier':
        // Check if it's a variable
        if (context.variables[node.name!] !== undefined) {
          return context.variables[node.name!];
        }
        
        // Check if it's a field reference (high, low, close, etc.)
        return this.getFieldValue(node.name!, context);
      
      case 'operator':
        const left = this.evaluateNode(node.left!, context);
        const right = this.evaluateNode(node.right!, context);
        
        switch (node.operator) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return right !== 0 ? left / right : NaN;
          default: return NaN;
        }
      
      case 'comparison':
        const leftComp = this.evaluateNode(node.left!, context);
        const rightComp = this.evaluateNode(node.right!, context);
        
        switch (node.operator) {
          case '<': return leftComp < rightComp ? 1 : 0;
          case '>': return leftComp > rightComp ? 1 : 0;
          case '<=': return leftComp <= rightComp ? 1 : 0;
          case '>=': return leftComp >= rightComp ? 1 : 0;
          case '==': return leftComp === rightComp ? 1 : 0;
          case '!=': return leftComp !== rightComp ? 1 : 0;
          default: return NaN;
        }
      
      case 'function':
        return this.evaluateFunction(node.name!, node.args || [], context);
      
      default:
        return NaN;
    }
  }

  /**
   * Get field value from OHLCV data
   */
  private getFieldValue(fieldName: string, context: EvaluationContext): number {
    const data = context.data[context.currentIndex];
    if (!data) return NaN;
    
    const normalizedField = fieldName.toLowerCase();
    
    switch (normalizedField) {
      case 'open':
      case 'o':
        return data.open;
      case 'high':
      case 'h':
        return data.high;
      case 'low':
      case 'l':
        return data.low;
      case 'close':
      case 'c':
      case 'cl':
        return data.close;
      case 'volume':
      case 'v':
        return data.volume;
      default:
        return NaN;
    }
  }

  /**
   * Evaluate function call
   */
  private evaluateFunction(name: string, args: FormulaAST[], context: EvaluationContext): number {
    switch (name.toLowerCase()) {
      case 'highest':
        return this.highest(args, context);
      
      case 'lowest':
        return this.lowest(args, context);
      
      case 'valuewhen':
        return this.valuewhen(args, context);
      
      case 'h':
        return this.offsetHigh(args, context);
      
      case 'l':
        return this.offsetLow(args, context);
      
      case 'c':
        return this.offsetClose(args, context);
      
      case 'o':
        return this.offsetOpen(args, context);
      
      case 'v':
        return this.offsetVolume(args, context);
      
      case 'avg':
      case 'average':
        return this.average(args, context);
      
      case 'sum':
        return this.sum(args, context);
      
      default:
        console.warn(`Unknown function: ${name}`);
        return NaN;
    }
  }

  /**
   * highest(field, period) - Maximum value over period
   */
  private highest(args: FormulaAST[], context: EvaluationContext): number {
    if (args.length < 1) return NaN;
    
    const field = args[0];
    const period = args.length > 1 ? this.evaluateNode(args[1], context) : 20;
    
    let max = -Infinity;
    const startIndex = Math.max(0, context.currentIndex - period + 1);
    
    for (let i = startIndex; i <= context.currentIndex; i++) {
      const tempContext = { ...context, currentIndex: i };
      const value = this.evaluateNode(field, tempContext);
      if (!isNaN(value) && value > max) {
        max = value;
      }
    }
    
    return max === -Infinity ? NaN : max;
  }

  /**
   * lowest(field, period) - Minimum value over period
   */
  private lowest(args: FormulaAST[], context: EvaluationContext): number {
    if (args.length < 1) return NaN;
    
    const field = args[0];
    const period = args.length > 1 ? this.evaluateNode(args[1], context) : 20;
    
    let min = Infinity;
    const startIndex = Math.max(0, context.currentIndex - period + 1);
    
    for (let i = startIndex; i <= context.currentIndex; i++) {
      const tempContext = { ...context, currentIndex: i };
      const value = this.evaluateNode(field, tempContext);
      if (!isNaN(value) && value < min) {
        min = value;
      }
    }
    
    return min === Infinity ? NaN : min;
  }

  /**
   * valuewhen(condition, value) - Return value when condition is true
   */
  private valuewhen(args: FormulaAST[], context: EvaluationContext): number {
    if (args.length < 2) return NaN;
    
    const condition = this.evaluateNode(args[0], context);
    const value = this.evaluateNode(args[1], context);
    
    return condition !== 0 ? value : NaN;
  }

  /**
   * h(offset) - High price at offset
   */
  private offsetHigh(args: FormulaAST[], context: EvaluationContext): number {
    const offset = args.length > 0 ? this.evaluateNode(args[0], context) : 0;
    const index = context.currentIndex - offset;
    
    if (index < 0 || index >= context.data.length) return NaN;
    return context.data[index].high;
  }

  /**
   * l(offset) - Low price at offset
   */
  private offsetLow(args: FormulaAST[], context: EvaluationContext): number {
    const offset = args.length > 0 ? this.evaluateNode(args[0], context) : 0;
    const index = context.currentIndex - offset;
    
    if (index < 0 || index >= context.data.length) return NaN;
    return context.data[index].low;
  }

  /**
   * c(offset) - Close price at offset
   */
  private offsetClose(args: FormulaAST[], context: EvaluationContext): number {
    const offset = args.length > 0 ? this.evaluateNode(args[0], context) : 0;
    const index = context.currentIndex - offset;
    
    if (index < 0 || index >= context.data.length) return NaN;
    return context.data[index].close;
  }

  /**
   * o(offset) - Open price at offset
   */
  private offsetOpen(args: FormulaAST[], context: EvaluationContext): number {
    const offset = args.length > 0 ? this.evaluateNode(args[0], context) : 0;
    const index = context.currentIndex - offset;
    
    if (index < 0 || index >= context.data.length) return NaN;
    return context.data[index].open;
  }

  /**
   * v(offset) - Volume at offset
   */
  private offsetVolume(args: FormulaAST[], context: EvaluationContext): number {
    const offset = args.length > 0 ? this.evaluateNode(args[0], context) : 0;
    const index = context.currentIndex - offset;
    
    if (index < 0 || index >= context.data.length) return NaN;
    return context.data[index].volume;
  }

  /**
   * average(field, period) - Average value over period
   */
  private average(args: FormulaAST[], context: EvaluationContext): number {
    if (args.length < 1) return NaN;
    
    const field = args[0];
    const period = args.length > 1 ? this.evaluateNode(args[1], context) : 20;
    
    let sum = 0;
    let count = 0;
    const startIndex = Math.max(0, context.currentIndex - period + 1);
    
    for (let i = startIndex; i <= context.currentIndex; i++) {
      const tempContext = { ...context, currentIndex: i };
      const value = this.evaluateNode(field, tempContext);
      if (!isNaN(value)) {
        sum += value;
        count++;
      }
    }
    
    return count > 0 ? sum / count : NaN;
  }

  /**
   * sum(field, period) - Sum values over period
   */
  private sum(args: FormulaAST[], context: EvaluationContext): number {
    if (args.length < 1) return NaN;
    
    const field = args[0];
    const period = args.length > 1 ? this.evaluateNode(args[1], context) : 20;
    
    let sum = 0;
    const startIndex = Math.max(0, context.currentIndex - period + 1);
    
    for (let i = startIndex; i <= context.currentIndex; i++) {
      const tempContext = { ...context, currentIndex: i };
      const value = this.evaluateNode(field, tempContext);
      if (!isNaN(value)) {
        sum += value;
      }
    }
    
    return sum;
  }
}

/**
 * Generate 7-color signal lines from formulas
 */
export function generate7ColorSignals(
  formulas: Array<{ formula: FormulaAST; color: SignalLine['color']; name: string }>,
  data: OHLCVData[]
): SignalLine[] {
  const evaluator = new FormulaEvaluator();
  
  return formulas.map(({ formula, color, name }) => {
    const values = evaluator.evaluate(formula, data);
    
    return {
      color,
      name,
      values: data.map((d, i) => ({
        date: d.date,
        value: values[i],
      })),
    };
  });
}
