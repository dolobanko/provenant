export interface EvalTemplateCase {
  name: string;
  description?: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  scoringFn: string;
  weight: number;
  tags: string[];
}

export interface EvalTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  cases: EvalTemplateCase[];
}

export const EVAL_TEMPLATES: EvalTemplate[] = [
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Standard test cases for customer-facing support agents',
    category: 'Support',
    cases: [
      {
        name: 'Polite greeting response',
        description: 'Agent should respond helpfully to a basic greeting',
        input: { message: 'Hello, I need help with my order.' },
        expectedOutput: { contains: ['order', 'help'] },
        scoringFn: 'contains_keywords',
        weight: 1.0,
        tags: ['greeting', 'support'],
      },
      {
        name: 'Refund policy inquiry',
        description: 'Agent should explain the refund policy clearly',
        input: { message: 'Can I get a refund for my purchase made last week?' },
        scoringFn: 'llm_judge',
        weight: 1.5,
        tags: ['refund', 'policy'],
      },
      {
        name: 'Escalation trigger',
        description: 'Agent should offer to escalate when customer is angry',
        input: { message: 'I am extremely unhappy and want to speak to a manager right now.' },
        scoringFn: 'llm_judge',
        weight: 2.0,
        tags: ['escalation', 'angry-customer'],
      },
      {
        name: 'Order status check',
        description: 'Agent should ask for order ID to look up status',
        input: { message: 'Where is my order?' },
        expectedOutput: { asks_for: ['order id', 'order number'] },
        scoringFn: 'contains_keywords',
        weight: 1.0,
        tags: ['order', 'status'],
      },
    ],
  },
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Test cases for code generation, review, and debugging agents',
    category: 'Engineering',
    cases: [
      {
        name: 'Python function generation',
        description: 'Agent should write valid Python code',
        input: { task: 'Write a Python function to reverse a string.' },
        expectedOutput: { language: 'python', contains: ['def ', 'return'] },
        scoringFn: 'contains_keywords',
        weight: 1.0,
        tags: ['python', 'generation'],
      },
      {
        name: 'Code explanation',
        description: 'Agent should explain what code does in plain English',
        input: { code: 'for i in range(10):\n  print(i)', task: 'Explain what this code does.' },
        scoringFn: 'llm_judge',
        weight: 1.0,
        tags: ['explanation', 'python'],
      },
      {
        name: 'Security vulnerability detection',
        description: 'Agent should identify SQL injection risk',
        input: { code: "query = f\"SELECT * FROM users WHERE id = {user_input}\"", task: 'Review this code for security issues.' },
        expectedOutput: { mentions: ['injection', 'security', 'unsafe'] },
        scoringFn: 'contains_keywords',
        weight: 2.0,
        tags: ['security', 'review', 'sql'],
      },
      {
        name: 'Bug fix suggestion',
        description: 'Agent should identify and fix an off-by-one error',
        input: { code: 'for i in range(1, 10):\n  if i == 10:\n    print("done")', task: 'Find the bug in this code.' },
        scoringFn: 'llm_judge',
        weight: 1.5,
        tags: ['debugging', 'bug-fix'],
      },
    ],
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Test cases for research, synthesis, and information retrieval agents',
    category: 'Research',
    cases: [
      {
        name: 'Factual query',
        description: 'Agent should answer basic factual questions correctly',
        input: { query: 'What is the capital of France?' },
        expectedOutput: { answer: 'Paris' },
        scoringFn: 'contains_keywords',
        weight: 1.0,
        tags: ['factual', 'geography'],
      },
      {
        name: 'Source citation',
        description: 'Agent should cite sources when making claims',
        input: { query: 'What are the key findings of recent AI safety research?' },
        scoringFn: 'llm_judge',
        weight: 1.5,
        tags: ['citation', 'synthesis', 'ai'],
      },
      {
        name: 'Uncertainty acknowledgment',
        description: 'Agent should express appropriate uncertainty on speculative questions',
        input: { query: 'Will artificial general intelligence be achieved by 2030?' },
        scoringFn: 'llm_judge',
        weight: 1.0,
        tags: ['uncertainty', 'speculation'],
      },
    ],
  },
  {
    id: 'rag-qa',
    name: 'RAG Question Answering',
    description: 'Test cases for Retrieval-Augmented Generation question answering systems',
    category: 'RAG',
    cases: [
      {
        name: 'Document grounding',
        description: 'Agent should answer based on provided context',
        input: { context: 'Our return policy is 30 days from purchase date.', question: 'How many days do I have to return an item?' },
        expectedOutput: { answer: '30' },
        scoringFn: 'contains_keywords',
        weight: 1.0,
        tags: ['grounding', 'rag', 'factual'],
      },
      {
        name: 'Out-of-context refusal',
        description: 'Agent should refuse to answer questions not in the context',
        input: { context: 'Our product is a cloud database for developers.', question: 'What is the best pizza topping?' },
        scoringFn: 'llm_judge',
        weight: 1.5,
        tags: ['refusal', 'rag', 'scope'],
      },
      {
        name: 'Multi-hop reasoning',
        description: 'Agent should chain facts from context to answer',
        input: {
          context: 'Alice is the CEO. Bob is the VP of Engineering and reports to Alice. Carol is a Software Engineer and reports to Bob.',
          question: 'Who does Carol ultimately report to?',
        },
        expectedOutput: { answer: 'Alice' },
        scoringFn: 'contains_keywords',
        weight: 2.0,
        tags: ['reasoning', 'rag', 'multi-hop'],
      },
      {
        name: 'Conflicting information handling',
        description: 'Agent should note conflicts when context has contradictions',
        input: {
          context: 'Document A says the price is $99. Document B says the price is $79.',
          question: 'What is the price?',
        },
        scoringFn: 'llm_judge',
        weight: 1.5,
        tags: ['conflict', 'rag', 'ambiguity'],
      },
    ],
  },
];
