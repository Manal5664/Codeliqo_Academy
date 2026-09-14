-- Make the complete public program catalog manageable from the existing admin portal.
-- Existing stable IDs/slugs are retained so enrollments, batches and public URLs keep working.

alter table public.programs
  -- These columns are initially nullable so the seed can distinguish legacy rows
  -- from records that an administrator has already edited. Defaults and NOT NULL
  -- constraints are applied only after the legacy rows have been merged.
  add column if not exists short_title text,
  add column if not exists category text,
  add column if not exists full_description text,
  add column if not exists duration text,
  add column if not exists tools jsonb,
  add column if not exists outcomes jsonb,
  add column if not exists prerequisites jsonb,
  add column if not exists audience jsonb,
  add column if not exists curriculum jsonb,
  add column if not exists portfolio jsonb,
  add column if not exists capstone text,
  add column if not exists included jsonb,
  add column if not exists excluded jsonb,
  add column if not exists bonus text,
  add column if not exists display_order integer,
  add column if not exists status text,
  add column if not exists course_outline_path text,
  add column if not exists course_outline_name text;

with program_seed as (
  select *
  from jsonb_to_recordset($program_seed$[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "slug": "data-analyst",
    "code": "DA",
    "title": "AI-Powered Data Analyst Career Program",
    "short_title": "AI-Powered Data Analyst",
    "category": "data-science",
    "description": "Build a practical analytics toolkit for transforming business data into clear, defensible insights and decision-ready dashboards.",
    "full_description": "Build a practical analytics toolkit for transforming business data into clear, defensible insights and decision-ready dashboards.",
    "duration": "5 Months / 20 Weeks",
    "duration_weeks": 20,
    "live_hours": 60,
    "level": "Beginner → Job-Ready Junior Data Analyst",
    "registration_fee": 1000,
    "monthly_fee": 6000,
    "installment_months": 5,
    "tuition_fee": 30000,
    "total_fee": 31000,
    "tools": [
      "Excel",
      "SQL",
      "Power BI",
      "Python",
      "Pandas",
      "Statistics",
      "AI-Assisted Analytics"
    ],
    "outcomes": [
      "Junior Data Analyst",
      "Business Intelligence Analyst",
      "Reporting Analyst",
      "Data Analytics Intern"
    ],
    "prerequisites": [
      "No prior analytics experience required",
      "Comfort using a computer",
      "A laptop suitable for analytics tools"
    ],
    "audience": [
      "Career starters entering analytics",
      "Professionals who work with reports or business data",
      "Learners seeking a structured, project-based pathway"
    ],
    "curriculum": [
      {
        "period": "Weeks 1–3",
        "title": "Excel & Business Analytics",
        "topics": [
          "Excel foundations",
          "Business analysis",
          "Data cleaning and reporting"
        ]
      },
      {
        "period": "Weeks 4–7",
        "title": "SQL",
        "topics": [
          "Relational data",
          "Queries and joins",
          "Business analysis with SQL"
        ]
      },
      {
        "period": "Weeks 8–12",
        "title": "Power BI",
        "topics": [
          "DAX",
          "Data Modeling",
          "Dashboard Design",
          "Data Storytelling"
        ]
      },
      {
        "period": "Weeks 13–15",
        "title": "Python Analytics",
        "topics": [
          "Python",
          "Pandas",
          "Exploratory Data Analysis"
        ]
      },
      {
        "period": "Week 16",
        "title": "Applied Statistics",
        "topics": [
          "Descriptive statistics",
          "Interpretation",
          "Analytical reasoning"
        ]
      },
      {
        "period": "Week 17",
        "title": "Modern Data Foundations",
        "topics": [
          "ETL",
          "Data Warehouse Concepts",
          "Microsoft Fabric Exposure"
        ]
      },
      {
        "period": "Week 18",
        "title": "AI-Assisted Analytics",
        "topics": [
          "Responsible assistance",
          "Analysis workflows",
          "Validation"
        ]
      },
      {
        "period": "Weeks 19–20",
        "title": "Capstone & Career Preparation",
        "topics": [
          "Capstone",
          "Portfolio",
          "Career Preparation"
        ]
      }
    ],
    "portfolio": [
      "Excel Business Performance Dashboard",
      "SQL Business Analysis",
      "Python EDA Notebook",
      "End-to-End Power BI Capstone"
    ],
    "capstone": "An end-to-end business analytics case combining data preparation, analysis, dashboard design and clear presentation.",
    "included": [
      "Live instructor-led sessions",
      "Guided practical exercises",
      "Assignments and project reviews",
      "Capstone guidance",
      "Learning resources",
      "Certificate of Completion when eligibility requirements are met"
    ],
    "excluded": [
      "Machine Learning",
      "Deep Learning",
      "RAG or LangChain",
      "Agentic AI",
      "Hadoop or advanced PySpark"
    ],
    "bonus": "Optional Tableau Fundamentals Workshop",
    "display_order": 1,
    "status": "published",
    "active": true
  },
  {
    "id": "22222222-2222-4222-8222-222222222222",
    "slug": "data-science-ml",
    "code": "DSML",
    "title": "Applied Data Science & Machine Learning Engineering",
    "short_title": "Applied Data Science & ML",
    "category": "data-science",
    "description": "Move from data foundations to applied machine learning and the engineering practices required to package, track and deploy models.",
    "full_description": "Move from data foundations to applied machine learning and the engineering practices required to package, track and deploy models.",
    "duration": "6 Months / 24 Weeks",
    "duration_weeks": 24,
    "live_hours": 72,
    "level": "Foundation → Applied / Job-Ready",
    "registration_fee": 1000,
    "monthly_fee": 6500,
    "installment_months": 6,
    "tuition_fee": 39000,
    "total_fee": 40000,
    "tools": [
      "Python",
      "NumPy",
      "Pandas",
      "SQL",
      "Statistics",
      "Scikit-learn",
      "PyTorch",
      "PySpark",
      "FastAPI",
      "Docker",
      "MLflow"
    ],
    "outcomes": [
      "Junior Data Scientist",
      "Junior ML Engineer",
      "Applied ML Engineer",
      "Data Science Intern"
    ],
    "prerequisites": [
      "Basic computer fluency",
      "Comfort with school-level mathematics",
      "No professional programming experience required"
    ],
    "audience": [
      "Learners pursuing applied data science",
      "Analysts moving toward machine learning",
      "Developers adding practical ML engineering skills"
    ],
    "curriculum": [
      {
        "period": "Weeks 1–3",
        "title": "Python for Data Science",
        "topics": [
          "Python",
          "NumPy",
          "Pandas"
        ]
      },
      {
        "period": "Weeks 4–5",
        "title": "SQL & Data Acquisition",
        "topics": [
          "SQL",
          "Data acquisition",
          "Data quality"
        ]
      },
      {
        "period": "Weeks 6–8",
        "title": "Statistics & Probability",
        "topics": [
          "Statistics",
          "Probability",
          "Inference foundations"
        ]
      },
      {
        "period": "Weeks 9–11",
        "title": "Data Preparation",
        "topics": [
          "EDA",
          "Preprocessing",
          "Feature Engineering"
        ]
      },
      {
        "period": "Weeks 12–17",
        "title": "Applied Machine Learning",
        "topics": [
          "Regression",
          "Classification",
          "Ensemble Models",
          "Model Evaluation",
          "Hyperparameter Tuning",
          "Clustering",
          "Anomaly Detection",
          "Time Series"
        ]
      },
      {
        "period": "Weeks 18–19",
        "title": "Applied Deep Learning",
        "topics": [
          "PyTorch Primary",
          "Neural network practice",
          "TensorFlow / Keras Overview"
        ]
      },
      {
        "period": "Weeks 20–21",
        "title": "Data Engineering",
        "topics": [
          "PySpark",
          "Data pipelines",
          "Hadoop / HDFS Concepts"
        ]
      },
      {
        "period": "Weeks 22–23",
        "title": "ML Engineering",
        "topics": [
          "FastAPI Model APIs",
          "Docker",
          "MLflow",
          "CI/CD Concepts",
          "Model Monitoring Concepts"
        ]
      },
      {
        "period": "Week 24",
        "title": "Industry Capstone",
        "topics": [
          "Problem framing",
          "Model delivery",
          "Technical presentation"
        ]
      }
    ],
    "portfolio": [
      "Exploratory data analysis case study",
      "Supervised learning project",
      "Deep learning mini-project",
      "Deployed model API",
      "Industry capstone"
    ],
    "capstone": "A complete applied machine-learning solution covering data preparation, modeling, evaluation, packaging and technical communication.",
    "included": [
      "Live instructor-led sessions",
      "Guided practical exercises",
      "Assignments and project reviews",
      "Capstone guidance",
      "Learning resources",
      "Certificate of Completion when eligibility requirements are met"
    ],
    "excluded": [
      "A full Generative AI specialization",
      "Guaranteed job placement",
      "Production cloud credits"
    ],
    "bonus": "Exposure to Transformers, LLMs, Embeddings, RAG and Agents",
    "display_order": 2,
    "status": "published",
    "active": true
  },
  {
    "id": "33333333-3333-4333-8333-333333333333",
    "slug": "generative-agentic-ai",
    "code": "GENAI",
    "title": "Generative & Agentic AI Engineering",
    "short_title": "Generative & Agentic AI",
    "category": "artificial-intelligence",
    "description": "Engineer grounded, testable AI applications with language models, retrieval, tools, workflows, evaluation and production safeguards.",
    "full_description": "Engineer grounded, testable AI applications with language models, retrieval, tools, workflows, evaluation and production safeguards.",
    "duration": "5 Months / 20 Weeks",
    "duration_weeks": 20,
    "live_hours": 60,
    "level": "Python-Aware Beginner → Applied AI Engineer",
    "registration_fee": 1000,
    "monthly_fee": 8000,
    "installment_months": 5,
    "tuition_fee": 40000,
    "total_fee": 41000,
    "tools": [
      "LLMs",
      "Prompt Engineering",
      "Context Engineering",
      "FastAPI",
      "Pydantic",
      "Embeddings",
      "Vector Databases",
      "RAG",
      "Tool Calling",
      "LangChain",
      "LangGraph",
      "n8n",
      "MCP",
      "Agentic AI",
      "Evaluation",
      "Guardrails",
      "Docker"
    ],
    "outcomes": [
      "Junior GenAI Engineer",
      "AI Application Developer",
      "RAG Developer",
      "Agentic AI Developer",
      "AI Automation Developer"
    ],
    "prerequisites": [
      "Basic Python is required",
      "Comfort working with APIs and JSON is helpful",
      "A development-capable laptop"
    ],
    "audience": [
      "Python learners moving into applied AI",
      "Developers building LLM-powered products",
      "Automation practitioners creating robust AI workflows"
    ],
    "curriculum": [
      {
        "period": "Week 1",
        "title": "LLM Systems Foundations",
        "topics": [
          "LLM foundations",
          "First Python LLM Call"
        ]
      },
      {
        "period": "Week 2",
        "title": "Reliable LLM APIs",
        "topics": [
          "LLM APIs",
          "Structured Outputs",
          "Pydantic",
          "Cost / Error Basics"
        ]
      },
      {
        "period": "Week 3",
        "title": "Prompt & Context Engineering",
        "topics": [
          "Prompt Engineering",
          "Context Engineering",
          "Prompt Injection Awareness"
        ]
      },
      {
        "period": "Week 4",
        "title": "AI Application APIs",
        "topics": [
          "FastAPI AI Applications",
          "Structured AI Assistant API"
        ]
      },
      {
        "period": "Week 5",
        "title": "Semantic Retrieval",
        "topics": [
          "Embeddings",
          "Semantic Search",
          "Vector Databases"
        ]
      },
      {
        "period": "Week 6",
        "title": "RAG From Scratch",
        "topics": [
          "Retrieval pipeline",
          "Grounded generation",
          "Citations"
        ]
      },
      {
        "period": "Week 7",
        "title": "Advanced RAG",
        "topics": [
          "Chunking",
          "Metadata",
          "Query Rewriting",
          "Reranking",
          "Hybrid Search Concepts"
        ]
      },
      {
        "period": "Week 8",
        "title": "RAG Evaluation",
        "topics": [
          "RAG Evaluation",
          "Production Issues",
          "Knowledge Assistant Project"
        ]
      },
      {
        "period": "Week 9",
        "title": "Tool / Function Calling",
        "topics": [
          "Schemas",
          "Tool execution",
          "Error handling"
        ]
      },
      {
        "period": "Week 10",
        "title": "Agent Architecture",
        "topics": [
          "Agent loops",
          "Multi-Tool Assistant"
        ]
      },
      {
        "period": "Week 11",
        "title": "LangChain",
        "topics": [
          "Components",
          "Composition",
          "Application patterns"
        ]
      },
      {
        "period": "Week 12",
        "title": "LangGraph",
        "topics": [
          "Graphs",
          "State",
          "Control flow"
        ]
      },
      {
        "period": "Week 13",
        "title": "Stateful Agentic Workflows",
        "topics": [
          "Memory",
          "Persistence",
          "Human-in-the-loop patterns"
        ]
      },
      {
        "period": "Week 14",
        "title": "n8n AI Workflow Automation",
        "topics": [
          "Workflow design",
          "AI nodes",
          "Integration patterns"
        ]
      },
      {
        "period": "Week 15",
        "title": "MCP",
        "topics": [
          "Model Context Protocol",
          "Tools and resources",
          "Integration"
        ]
      },
      {
        "period": "Week 16",
        "title": "Multi-Agent Systems",
        "topics": [
          "Coordination patterns",
          "Delegation",
          "Failure modes"
        ]
      },
      {
        "period": "Week 17",
        "title": "AI Evaluation",
        "topics": [
          "Test Sets",
          "Tool Correctness",
          "Hallucination Evaluation",
          "RAGAS / DeepEval Concepts"
        ]
      },
      {
        "period": "Week 18",
        "title": "Guardrails & Operations",
        "topics": [
          "Security",
          "Guardrails",
          "Observability"
        ]
      },
      {
        "period": "Week 19",
        "title": "Production AI",
        "topics": [
          "FastAPI",
          "Docker",
          "Configuration",
          "Logging",
          "Authentication Concepts",
          "Deployment"
        ]
      },
      {
        "period": "Week 20",
        "title": "Signature Capstone",
        "topics": [
          "Integration",
          "Evaluation",
          "Demonstration"
        ]
      }
    ],
    "portfolio": [
      "Structured AI Assistant API",
      "Semantic Search Application",
      "Evaluated Knowledge Assistant",
      "Multi-Tool Agent",
      "Stateful Agentic Workflow"
    ],
    "capstone": "LLM + RAG + Vector Database + Tools + LangGraph + State + API + Evaluation + Guardrails + Docker",
    "included": [
      "Live instructor-led sessions",
      "Guided practical exercises",
      "Assignments and project reviews",
      "Capstone guidance",
      "Learning resources",
      "Certificate of Completion when eligibility requirements are met"
    ],
    "excluded": [
      "Foundational Python training",
      "Model pretraining from scratch",
      "Guaranteed infrastructure or paid API credits"
    ],
    "bonus": "Exposure only: Open-Source LLM / Fine-Tuning Landscape, Hugging Face, Local Inference and LoRA / QLoRA Concepts",
    "display_order": 3,
    "status": "published",
    "active": true
  },
  {
    "id": "44444444-4444-4444-8444-444444444444",
    "slug": "frontend-developer",
    "code": "FE",
    "title": "Frontend Developer Career Program",
    "short_title": "Frontend Developer",
    "category": "software-development",
    "description": "Learn to build accessible, responsive and maintainable web interfaces using the modern JavaScript and React ecosystem.",
    "full_description": "Learn to build accessible, responsive and maintainable web interfaces using the modern JavaScript and React ecosystem.",
    "duration": "4 Months / 16 Weeks",
    "duration_weeks": 16,
    "live_hours": 48,
    "level": "Beginner → Job-Ready Junior Frontend Developer",
    "registration_fee": 1000,
    "monthly_fee": 6000,
    "installment_months": 4,
    "tuition_fee": 24000,
    "total_fee": 25000,
    "tools": [
      "HTML5",
      "CSS3",
      "JavaScript",
      "TypeScript",
      "React",
      "Tailwind CSS",
      "REST APIs",
      "Git",
      "GitHub",
      "Testing",
      "Deployment"
    ],
    "outcomes": [
      "Junior Frontend Developer",
      "React Developer Intern",
      "Web UI Developer",
      "Frontend Freelancer"
    ],
    "prerequisites": [
      "No prior coding experience required",
      "Basic computer skills",
      "A laptop and reliable internet connection"
    ],
    "audience": [
      "Complete beginners entering web development",
      "Design-minded learners who want to code interfaces",
      "Self-taught developers seeking structure and feedback"
    ],
    "curriculum": [
      {
        "period": "Week 1",
        "title": "HTML5 & The Web",
        "topics": [
          "HTML5",
          "How the Web Works"
        ]
      },
      {
        "period": "Week 2",
        "title": "Professional HTML",
        "topics": [
          "Forms",
          "Semantic HTML",
          "Accessibility foundations"
        ]
      },
      {
        "period": "Week 3",
        "title": "CSS Foundations",
        "topics": [
          "Cascade",
          "Layout",
          "Visual styling"
        ]
      },
      {
        "period": "Week 4",
        "title": "Modern Responsive CSS",
        "topics": [
          "Responsive layouts",
          "Responsive Business Website"
        ]
      },
      {
        "period": "Week 5",
        "title": "JavaScript Fundamentals",
        "topics": [
          "Syntax",
          "Logic",
          "Functions"
        ]
      },
      {
        "period": "Week 6",
        "title": "Modern JavaScript",
        "topics": [
          "Arrays",
          "Objects",
          "Modern JavaScript"
        ]
      },
      {
        "period": "Week 7",
        "title": "DOM Applications",
        "topics": [
          "DOM",
          "Interactive Applications",
          "Task Manager / Expense Tracker"
        ]
      },
      {
        "period": "Week 8",
        "title": "Async JavaScript & APIs",
        "topics": [
          "Async JavaScript",
          "REST APIs",
          "API-Powered JavaScript App"
        ]
      },
      {
        "period": "Week 9",
        "title": "TypeScript",
        "topics": [
          "Types",
          "Interfaces",
          "Safer application code"
        ]
      },
      {
        "period": "Week 10",
        "title": "React Fundamentals",
        "topics": [
          "Components",
          "Props",
          "State"
        ]
      },
      {
        "period": "Week 11",
        "title": "Hooks & Forms",
        "topics": [
          "Hooks",
          "Forms",
          "Validation"
        ]
      },
      {
        "period": "Week 12",
        "title": "React + REST APIs",
        "topics": [
          "Data fetching",
          "Loading states",
          "API integration"
        ]
      },
      {
        "period": "Week 13",
        "title": "Application Architecture",
        "topics": [
          "Context",
          "Custom Hooks",
          "Authentication UI",
          "Tailwind",
          "React Dashboard / SaaS Frontend"
        ]
      },
      {
        "period": "Week 14",
        "title": "Professional Workflow",
        "topics": [
          "Git",
          "Testing",
          "Code Quality",
          "Next.js Exposure"
        ]
      },
      {
        "period": "Week 15",
        "title": "Deployment & Portfolio",
        "topics": [
          "Deployment",
          "Documentation",
          "Portfolio"
        ]
      },
      {
        "period": "Week 16",
        "title": "Frontend Capstone",
        "topics": [
          "Independent build",
          "Review",
          "Presentation"
        ]
      }
    ],
    "portfolio": [
      "Responsive Business Website",
      "JavaScript Interactive App",
      "API-Powered JavaScript App",
      "React Dashboard / SaaS Frontend",
      "Independent Frontend Capstone"
    ],
    "capstone": "An independent, production-minded frontend application demonstrating responsive design, API integration, accessibility and deployment.",
    "included": [
      "Live instructor-led sessions",
      "Guided practical exercises",
      "Assignments and project reviews",
      "Capstone guidance",
      "Learning resources",
      "Certificate of Completion when eligibility requirements are met"
    ],
    "excluded": [
      "Backend API development",
      "Native mobile development",
      "Guaranteed job placement"
    ],
    "bonus": null,
    "display_order": 4,
    "status": "published",
    "active": true
  },
  {
    "id": "55555555-5555-4555-8555-555555555555",
    "slug": "python-backend",
    "code": "BE",
    "title": "Python Backend Developer Career Program",
    "short_title": "Python Backend Developer",
    "category": "software-development",
    "description": "Build secure, tested and database-backed APIs with Python, FastAPI and PostgreSQL, then package them for deployment.",
    "full_description": "Build secure, tested and database-backed APIs with Python, FastAPI and PostgreSQL, then package them for deployment.",
    "duration": "4 Months / 16 Weeks",
    "duration_weeks": 16,
    "live_hours": 48,
    "level": "Beginner → Job-Ready Junior Python Backend Developer",
    "registration_fee": 1000,
    "monthly_fee": 6000,
    "installment_months": 4,
    "tuition_fee": 24000,
    "total_fee": 25000,
    "tools": [
      "Python",
      "SQL",
      "PostgreSQL",
      "FastAPI",
      "REST APIs",
      "Pydantic",
      "SQLAlchemy",
      "Alembic",
      "JWT",
      "Pytest",
      "Git",
      "GitHub",
      "Docker",
      "CI/CD",
      "Deployment"
    ],
    "outcomes": [
      "Junior Python Developer",
      "Junior Backend Developer",
      "API Developer Intern",
      "Backend Engineering Intern"
    ],
    "prerequisites": [
      "No prior coding experience required",
      "Basic computer skills",
      "A development-capable laptop"
    ],
    "audience": [
      "Beginners drawn to systems and application logic",
      "Python learners moving into backend development",
      "Frontend developers seeking API skills"
    ],
    "curriculum": [
      {
        "period": "Week 1",
        "title": "Python Foundations",
        "topics": [
          "Syntax",
          "Variables",
          "Control flow"
        ]
      },
      {
        "period": "Week 2",
        "title": "Functions & Data Structures",
        "topics": [
          "Functions",
          "Lists and dictionaries",
          "Problem solving"
        ]
      },
      {
        "period": "Week 3",
        "title": "Professional Python",
        "topics": [
          "Modules",
          "Virtual Environments",
          "Exceptions",
          "JSON",
          "Environment Variables",
          "Type Hints"
        ]
      },
      {
        "period": "Week 4",
        "title": "Backend Python",
        "topics": [
          "OOP",
          "Backend Python",
          "Async Intuition"
        ]
      },
      {
        "period": "Week 5",
        "title": "SQL",
        "topics": [
          "Queries",
          "Joins",
          "Data manipulation"
        ]
      },
      {
        "period": "Week 6",
        "title": "PostgreSQL Design",
        "topics": [
          "PostgreSQL",
          "Relational Database Design"
        ]
      },
      {
        "period": "Week 7",
        "title": "FastAPI Fundamentals",
        "topics": [
          "Routing",
          "Requests",
          "Responses"
        ]
      },
      {
        "period": "Week 8",
        "title": "API Architecture",
        "topics": [
          "Pydantic",
          "Validation",
          "API Architecture"
        ]
      },
      {
        "period": "Week 9",
        "title": "Production API Patterns",
        "topics": [
          "Pagination",
          "Filtering",
          "Search",
          "File Upload",
          "External APIs",
          "Async Patterns",
          "Background Tasks",
          "Logging"
        ]
      },
      {
        "period": "Week 10",
        "title": "SQLAlchemy",
        "topics": [
          "ORM models",
          "Queries",
          "Relationships"
        ]
      },
      {
        "period": "Week 11",
        "title": "Database Engineering",
        "topics": [
          "Alembic",
          "Migrations",
          "Database Engineering"
        ]
      },
      {
        "period": "Week 12",
        "title": "Authentication & Security",
        "topics": [
          "JWT",
          "Authentication",
          "Security"
        ]
      },
      {
        "period": "Week 13",
        "title": "Testing & Quality",
        "topics": [
          "Pytest",
          "Git",
          "Code Quality"
        ]
      },
      {
        "period": "Week 14",
        "title": "Deployment",
        "topics": [
          "Docker",
          "Deployment",
          "CI/CD Exposure"
        ]
      },
      {
        "period": "Week 15",
        "title": "Independent Backend Project",
        "topics": [
          "Design",
          "Build",
          "Review"
        ]
      },
      {
        "period": "Week 16",
        "title": "Production Backend Capstone",
        "topics": [
          "Integration",
          "Testing",
          "Delivery"
        ]
      }
    ],
    "portfolio": [
      "Python JSON Application",
      "PostgreSQL Project",
      "FastAPI REST API",
      "Authenticated Database-Backed API",
      "Dockerized Backend",
      "Production Backend Capstone"
    ],
    "capstone": "A documented, tested and Dockerized database-backed API with authentication, validation and production-minded structure.",
    "included": [
      "Live instructor-led sessions",
      "Guided practical exercises",
      "Assignments and project reviews",
      "Capstone guidance",
      "Learning resources",
      "Certificate of Completion when eligibility requirements are met"
    ],
    "excluded": [
      "Frontend application development",
      "Cloud infrastructure specialization",
      "Guaranteed job placement"
    ],
    "bonus": null,
    "display_order": 5,
    "status": "published",
    "active": true
  },
  {
    "id": "66666666-6666-4666-8666-666666666666",
    "slug": "full-stack",
    "code": "FS",
    "title": "Full-Stack Developer Career Program",
    "short_title": "Full-Stack Developer",
    "category": "software-development",
    "description": "A complete pathway combining the Frontend Developer Career Program and Python Backend Developer Career Program, followed by full-stack integration and a production capstone.",
    "full_description": "A complete pathway combining the Frontend Developer Career Program and Python Backend Developer Career Program, followed by full-stack integration and a production capstone.",
    "duration": "8 Months / 32 Weeks",
    "duration_weeks": 32,
    "live_hours": 96,
    "level": "Beginner → Job-Ready Junior Full-Stack Developer",
    "registration_fee": 1000,
    "monthly_fee": 5500,
    "installment_months": 8,
    "tuition_fee": 44000,
    "total_fee": 45000,
    "tools": [
      "HTML5",
      "CSS3",
      "JavaScript",
      "TypeScript",
      "React",
      "Tailwind CSS",
      "Python",
      "FastAPI",
      "SQLAlchemy",
      "PostgreSQL",
      "JWT",
      "Testing",
      "Docker",
      "Deployment"
    ],
    "outcomes": [
      "Junior Full-Stack Developer",
      "Junior Web Application Developer",
      "Software Engineering Intern",
      "Full-Stack Freelancer"
    ],
    "prerequisites": [
      "No prior coding experience required",
      "Commitment to an extended project-based pathway",
      "A development-capable laptop"
    ],
    "audience": [
      "Beginners seeking a complete web development pathway",
      "Learners who want to own frontend and backend delivery",
      "Aspiring developers building a substantial portfolio"
    ],
    "curriculum": [
      {
        "period": "Weeks 1–16",
        "title": "Complete Frontend Curriculum",
        "topics": [
          "HTML and CSS",
          "JavaScript and TypeScript",
          "React and Tailwind CSS",
          "REST API integration",
          "Testing and deployment",
          "Frontend capstone"
        ]
      },
      {
        "period": "Weeks 17–30",
        "title": "Complete Python Backend Curriculum",
        "topics": [
          "Python",
          "SQL and PostgreSQL",
          "FastAPI and Pydantic",
          "SQLAlchemy and Alembic",
          "JWT security",
          "Testing, Docker and deployment"
        ]
      },
      {
        "period": "Week 31",
        "title": "Full-Stack Integration",
        "topics": [
          "React",
          "REST APIs",
          "FastAPI",
          "SQLAlchemy",
          "PostgreSQL",
          "JWT Authentication",
          "Frontend Authentication State",
          "Protected Pages",
          "Protected Endpoints",
          "CRUD",
          "Validation",
          "Error Handling",
          "CORS",
          "Environment Configuration"
        ]
      },
      {
        "period": "Week 32",
        "title": "Production Full-Stack Capstone",
        "topics": [
          "Integration",
          "Debugging",
          "Testing",
          "Docker",
          "Deployment",
          "README",
          "Architecture",
          "GitHub",
          "Presentation"
        ]
      }
    ],
    "portfolio": [
      "Responsive frontend applications",
      "Interactive JavaScript projects",
      "React SaaS frontend",
      "FastAPI database-backed API",
      "Authenticated full-stack application"
    ],
    "capstone": "Choose a production-minded E-commerce Platform, Learning Management System, Job Portal or Project Management SaaS and deliver it end to end.",
    "included": [
      "Live instructor-led sessions",
      "Guided practical exercises",
      "Assignments and project reviews",
      "Capstone guidance",
      "Learning resources",
      "Certificate of Completion when eligibility requirements are met"
    ],
    "excluded": [
      "Native mobile development",
      "DevOps specialization",
      "Guaranteed job placement"
    ],
    "bonus": null,
    "display_order": 6,
    "status": "published",
    "active": true
  }
]$program_seed$::jsonb) as item (
    id uuid,
    slug text,
    code text,
    title text,
    short_title text,
    category text,
    description text,
    full_description text,
    duration text,
    duration_weeks integer,
    live_hours integer,
    level text,
    registration_fee numeric,
    monthly_fee numeric,
    installment_months integer,
    tuition_fee numeric,
    total_fee numeric,
    tools jsonb,
    outcomes jsonb,
    prerequisites jsonb,
    audience jsonb,
    curriculum jsonb,
    portfolio jsonb,
    capstone text,
    included jsonb,
    excluded jsonb,
    bonus text,
    display_order integer,
    status text,
    active boolean
  )
)
insert into public.programs (
  id, slug, code, title, short_title, category, description, full_description,
  duration, duration_weeks, live_hours, level, registration_fee, monthly_fee,
  installment_months, tuition_fee, total_fee, tools, outcomes, prerequisites,
  audience, curriculum, portfolio, capstone, included, excluded, bonus,
  display_order, status, active
)
select
  id, slug, code, title, short_title, category, description, full_description,
  duration, duration_weeks, live_hours, level, registration_fee, monthly_fee,
  installment_months, tuition_fee, total_fee, tools, outcomes, prerequisites,
  audience, curriculum, portfolio, capstone, included, excluded, bonus,
  display_order, status, active
from program_seed
on conflict (id) do update set
  -- Preserve every pre-existing base value and every value already populated by
  -- an administrator. Only fill columns that did not exist in the legacy schema.
  short_title = coalesce(programs.short_title, excluded.short_title),
  category = coalesce(programs.category, excluded.category),
  full_description = coalesce(programs.full_description, excluded.full_description),
  duration = coalesce(programs.duration, excluded.duration),
  tools = coalesce(programs.tools, excluded.tools),
  outcomes = coalesce(programs.outcomes, excluded.outcomes),
  prerequisites = coalesce(programs.prerequisites, excluded.prerequisites),
  audience = coalesce(programs.audience, excluded.audience),
  curriculum = coalesce(programs.curriculum, excluded.curriculum),
  portfolio = coalesce(programs.portfolio, excluded.portfolio),
  capstone = coalesce(programs.capstone, excluded.capstone),
  included = coalesce(programs.included, excluded.included),
  excluded = coalesce(programs.excluded, excluded.excluded),
  bonus = coalesce(programs.bonus, excluded.bonus),
  display_order = coalesce(programs.display_order, excluded.display_order),
  status = coalesce(programs.status, excluded.status);

-- Safely support any pre-existing program beyond the original six. Active
-- legacy rows remain public and inactive rows become drafts; no row is deleted.
with unordered as (
  select id, (100 + row_number() over (order by created_at, id))::integer as fallback_order
  from public.programs
  where display_order is null
)
update public.programs as program
set
  short_title = coalesce(program.short_title, program.title),
  category = coalesce(program.category, 'career-program'),
  full_description = coalesce(program.full_description, program.description),
  duration = coalesce(program.duration, program.duration_weeks::text || ' Weeks'),
  tools = coalesce(program.tools, '[]'::jsonb),
  outcomes = coalesce(program.outcomes, '[]'::jsonb),
  prerequisites = coalesce(program.prerequisites, '[]'::jsonb),
  audience = coalesce(program.audience, '[]'::jsonb),
  curriculum = coalesce(program.curriculum, '[]'::jsonb),
  portfolio = coalesce(program.portfolio, '[]'::jsonb),
  capstone = coalesce(program.capstone, ''),
  included = coalesce(program.included, '[]'::jsonb),
  excluded = coalesce(program.excluded, '[]'::jsonb),
  display_order = unordered.fallback_order,
  status = coalesce(program.status, case when program.active then 'published' else 'draft' end)
from unordered
where program.id = unordered.id;

-- Rows that already had an order still need the same nullable-column backfill.
update public.programs
set
  short_title = coalesce(short_title, title),
  category = coalesce(category, 'career-program'),
  full_description = coalesce(full_description, description),
  duration = coalesce(duration, duration_weeks::text || ' Weeks'),
  tools = coalesce(tools, '[]'::jsonb),
  outcomes = coalesce(outcomes, '[]'::jsonb),
  prerequisites = coalesce(prerequisites, '[]'::jsonb),
  audience = coalesce(audience, '[]'::jsonb),
  curriculum = coalesce(curriculum, '[]'::jsonb),
  portfolio = coalesce(portfolio, '[]'::jsonb),
  capstone = coalesce(capstone, ''),
  included = coalesce(included, '[]'::jsonb),
  excluded = coalesce(excluded, '[]'::jsonb),
  status = coalesce(status, case when active then 'published' else 'draft' end);

alter table public.programs
  alter column short_title set default '',
  alter column short_title set not null,
  alter column category set default 'career-program',
  alter column category set not null,
  alter column full_description set default '',
  alter column full_description set not null,
  alter column duration set default '',
  alter column duration set not null,
  alter column tools set default '[]'::jsonb,
  alter column tools set not null,
  alter column outcomes set default '[]'::jsonb,
  alter column outcomes set not null,
  alter column prerequisites set default '[]'::jsonb,
  alter column prerequisites set not null,
  alter column audience set default '[]'::jsonb,
  alter column audience set not null,
  alter column curriculum set default '[]'::jsonb,
  alter column curriculum set not null,
  alter column portfolio set default '[]'::jsonb,
  alter column portfolio set not null,
  alter column capstone set default '',
  alter column capstone set not null,
  alter column included set default '[]'::jsonb,
  alter column included set not null,
  alter column excluded set default '[]'::jsonb,
  alter column excluded set not null,
  alter column display_order set default 100,
  alter column display_order set not null,
  alter column status set default 'draft',
  alter column status set not null;

alter table public.programs
  drop constraint if exists programs_slug_format,
  drop constraint if exists programs_status_check,
  drop constraint if exists programs_display_order_check,
  drop constraint if exists programs_content_arrays_check,
  drop constraint if exists programs_required_text_check,
  drop constraint if exists programs_outline_pair_check,
  add constraint programs_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint programs_status_check check (status in ('draft', 'published')),
  add constraint programs_display_order_check check (display_order >= 0),
  add constraint programs_required_text_check check (
    length(trim(title)) > 0
    and length(trim(short_title)) > 0
    and length(trim(category)) > 0
    and length(trim(code)) > 0
    and length(trim(description)) > 0
    and length(trim(full_description)) > 0
    and length(trim(duration)) > 0
    and length(trim(level)) > 0
  ),
  add constraint programs_content_arrays_check check (
    jsonb_typeof(tools) = 'array'
    and jsonb_typeof(outcomes) = 'array'
    and jsonb_typeof(prerequisites) = 'array'
    and jsonb_typeof(audience) = 'array'
    and jsonb_typeof(curriculum) = 'array'
    and jsonb_typeof(portfolio) = 'array'
    and jsonb_typeof(included) = 'array'
    and jsonb_typeof(excluded) = 'array'
  ),
  add constraint programs_outline_pair_check check (
    (course_outline_path is null and course_outline_name is null)
    or (length(trim(course_outline_path)) > 0 and length(trim(course_outline_name)) > 0)
  );

create unique index if not exists programs_slug_case_insensitive_unique on public.programs (lower(slug));
create unique index if not exists programs_code_case_insensitive_unique on public.programs (lower(code));
create index if not exists programs_public_display_order_idx on public.programs (display_order, created_at, id) where status = 'published';

drop policy if exists "public reads active programs" on public.programs;
drop policy if exists "public reads published programs" on public.programs;
create policy "public reads published programs"
on public.programs
for select
to anon, authenticated
using (status = 'published' or public.is_admin() or public.has_active_access(id, null));

comment on column public.programs.active is 'Operational LMS/enrollment availability; independent from public publishing status.';
comment on column public.programs.status is 'Public visibility: draft or published.';
comment on column public.programs.display_order is 'Ascending public catalog order; ties use created_at then id.';
comment on column public.programs.course_outline_path is 'Object path in the public course-outlines Storage bucket.';
comment on column public.programs.course_outline_name is 'Original PDF filename displayed to administrators and visitors.';

-- Course outlines use the project\'s existing Supabase Storage architecture.
-- Files are public course documents; only administrators may upload/replace them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-outlines', 'course-outlines', true, 10485760, array['application/pdf'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads course outlines" on storage.objects;
create policy "public reads course outlines"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'course-outlines');

drop policy if exists "admins upload course outlines" on storage.objects;
create policy "admins upload course outlines"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'course-outlines'
  and name ~ '^[0-9a-f-]+/[0-9a-f-]+-[^/]+\.pdf$'
  and public.is_admin()
);

drop policy if exists "admins update course outlines" on storage.objects;
create policy "admins update course outlines"
on storage.objects
for update
to authenticated
using (bucket_id = 'course-outlines' and public.is_admin())
with check (
  bucket_id = 'course-outlines'
  and name ~ '^[0-9a-f-]+/[0-9a-f-]+-[^/]+\.pdf$'
  and public.is_admin()
);

drop policy if exists "admins delete course outlines" on storage.objects;
create policy "admins delete course outlines"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'course-outlines'
  and name ~ '^[0-9a-f-]+/[0-9a-f-]+-[^/]+\.pdf$'
  and public.is_admin()
);
