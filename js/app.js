const expressionDisplay = document.querySelector('#expression');
const resultDisplay = document.querySelector('#result');
const angleButton = document.querySelector('#angle-mode');
const keypad = document.querySelector('.keypad');

let expression = '';
let lastResult = 0;
let angleMode = 'DEG';
let justEvaluated = false;

function tokenize(source) {
  const input = source.trim();
  const pattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|(sin|cos|tan)\b|([()+\-*/]))/gy;
  const tokens = [];
  let position = 0;

  while (position < input.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(input);
    if (!match) throw new Error('Invalid expression');
    position = pattern.lastIndex;

    if (match[1]) {
      tokens.push({ type: 'number', value: Number(match[0].trim()) });
    } else if (match[2]) {
      tokens.push({ type: 'function', value: match[2].toLowerCase() });
    } else {
      tokens.push({ type: match[3], value: match[3] });
    }
  }

  return tokens;
}

function calculate(source) {
  const tokens = tokenize(source);
  let position = 0;

  function take(type) {
    if (tokens[position]?.type !== type) return false;
    position += 1;
    return true;
  }

  function expressionValue() {
    let value = term();
    while (tokens[position]?.type === '+' || tokens[position]?.type === '-') {
      const operator = tokens[position++].type;
      const right = term();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  function term() {
    let value = unary();
    while (tokens[position]?.type === '*' || tokens[position]?.type === '/') {
      const operator = tokens[position++].type;
      const right = unary();
      if (operator === '/' && right === 0) throw new Error('Cannot divide by zero');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }

  function unary() {
    if (take('+')) return unary();
    if (take('-')) return -unary();
    return primary();
  }

  function primary() {
    const token = tokens[position];
    if (!token) throw new Error('Incomplete expression');

    if (token.type === 'number') {
      position += 1;
      return token.value;
    }

    if (take('(')) {
      const value = expressionValue();
      if (!take(')')) throw new Error('Missing closing parenthesis');
      return value;
    }

    if (token.type === 'function') {
      position += 1;
      if (!take('(')) throw new Error('Expected an opening parenthesis');
      const argument = expressionValue();
      if (!take(')')) throw new Error('Missing closing parenthesis');
      const radians = angleMode === 'DEG' ? argument * Math.PI / 180 : argument;
      if (token.value === 'tan' && Math.abs(Math.cos(radians)) < 1e-12) {
        throw new Error('Tangent is undefined at this angle');
      }
      return Math[token.value](radians);
    }

    throw new Error('Invalid expression');
  }

  if (!tokens.length) throw new Error('Enter a calculation');
  const value = expressionValue();
  if (position !== tokens.length) throw new Error('Check the expression');
  if (!Number.isFinite(value)) throw new Error('Result is out of range');
  return Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12));
}

const format = value => String(value);

function updateDisplay(message = '') {
  expressionDisplay.textContent = expression || 'Enter a calculation';
  if (message) resultDisplay.textContent = message;
}

function appendInput(value) {
  if (justEvaluated) {
    if (/^[0-9.(]$/.test(value) || /^(sin|cos|tan)\(/.test(value)) {
      expression = '';
    } else {
      expression = format(lastResult);
    }
    justEvaluated = false;
  }

  if (expression.length + value.length > 100) return;
  expression += value;
  updateDisplay();
}

function backspace() {
  if (justEvaluated) justEvaluated = false;
  if (/(sin|cos|tan)\($/.test(expression)) {
    expression = expression.replace(/(sin|cos|tan)\($/, '');
  } else {
    expression = expression.slice(0, -1);
  }
  updateDisplay();
}

function runCalculation() {
  try {
    lastResult = calculate(expression);
    resultDisplay.textContent = format(lastResult);
    justEvaluated = true;
  } catch (error) {
    resultDisplay.textContent = 'Error';
  }
}

function clear() {
  expression = '';
  lastResult = 0;
  justEvaluated = false;
  resultDisplay.textContent = '0';
  updateDisplay();
}

const actions = { clear, backspace, equals: runCalculation };
const handleInput = value => actions[value] ? actions[value]() : appendInput(value);

keypad.addEventListener('click', event => {
  const button = event.target.closest('button[data-input]');
  if (button) handleInput(button.dataset.input);
});

angleButton.addEventListener('click', () => {
  angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
  angleButton.textContent = angleMode;
  angleButton.setAttribute('aria-label', `Angle mode: ${angleMode === 'DEG' ? 'degrees' : 'radians'}`);
  angleButton.setAttribute('aria-pressed', String(angleMode === 'RAD'));
});

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  const functionKeys = { s: 'sin(', c: 'cos(', t: 'tan(' };
  const input = /^[0-9.+\-*/()]$/.test(key) ? key : key === 'x' ? '*' : functionKeys[key];
  if (input) return event.preventDefault(), appendInput(input);
  const action = ['enter', '='].includes(key) ? runCalculation : key === 'backspace' ? backspace : key === 'escape' ? clear : null;
  if (action) {
    if (key !== 'escape') event.preventDefault();
    action();
  }
});
