# System Architecture - System Design Simulator Platform

```mermaid
graph TB
    subgraph "Client Layer"
        User[👤 User Browser]
        Canvas[Visual Canvas<br/>Drag & Drop]
        Metrics[Real-time Metrics<br/>Dashboard]
    end
    
    subgraph "API Gateway"
        NGINX[NGINX Gateway<br/>Load Balancer]
    end
    
    subgraph "Application Layer"
        API[Backend API Server<br/>Node.js + Express.js]
        WS[WebSocket Server<br/>Socket.io]
        SimEngine[Simulation Engine<br/>Traffic & Load Simulator]
        
        API --> SimEngine
        WS --> SimEngine
    end
    
    subgraph "Core Services"
        AuthSvc[Authentication<br/>Service]
        UserIsolation[User Isolation<br/>Multi-tenant Service]
        MetricsSvc[Metrics Collection<br/>Service]
        CostCalc[Cost Modeling<br/>Calculator]
    end
    
    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL<br/>User Data, Designs,<br/>Progress, Scenarios)]
        Redis[(Redis<br/>Sessions, Cache,<br/>Real-time State)]
    end
    
    subgraph "External Services"
        Monitoring[Prometheus<br/>Monitoring]
        Queue[Message Queue<br/>Async Jobs]
    end
    
    User --> Canvas
    User --> Metrics
    Canvas --> NGINX
    Metrics --> NGINX
    
    NGINX --> API
    NGINX --> WS
    
    API --> AuthSvc
    API --> UserIsolation
    API --> MetricsSvc
    API --> CostCalc
    
    WS --> UserIsolation
    
    AuthSvc --> PostgreSQL
    AuthSvc --> Redis
    UserIsolation --> PostgreSQL
    MetricsSvc --> PostgreSQL
    CostCalc --> Redis
    
    SimEngine --> Redis
    SimEngine --> Queue
    
    API --> PostgreSQL
    API --> Redis
    
    MetricsSvc --> Monitoring
    API --> Monitoring
    
    style User fill:#4CAF50,color:#fff
    style Canvas fill:#2196F3,color:#fff
    style SimEngine fill:#FF9800,color:#fff
    style PostgreSQL fill:#336791,color:#fff
    style Redis fill:#DC382D,color:#fff
    style NGINX fill:#009639,color:#fff
```

## Key Components:

### **Frontend (Client Layer)**
- **Visual Canvas**: Drag-and-drop interface for building system architectures
- **Real-time Metrics Dashboard**: Live visualization of performance, latency, errors, costs

### **API Gateway**
- **NGINX**: Load balancing, SSL termination, request routing

### **Backend (Application Layer)**
- **API Server**: REST API for CRUD operations, scenario management
- **WebSocket Server**: Real-time bidirectional communication for live simulations
- **Simulation Engine**: Core logic that simulates traffic, calculates bottlenecks, models failures

### **Core Services**
- **Authentication**: User login, signup, JWT tokens
- **User Isolation**: Multi-tenant data isolation and resource management
- **Metrics Collection**: Captures and aggregates simulation metrics
- **Cost Calculator**: Real-time cost modeling based on component usage

### **Data Layer**
- **PostgreSQL**: Persists user data, saved designs, learning progress, scenarios
- **Redis**: Caches session data, simulation state, frequently accessed data

### **Supporting Infrastructure**
- **Prometheus**: Monitors system health, performance metrics
- **Message Queue**: Handles async jobs (report generation, background processing)

## Data Flow:

1. **User Designs System** → Canvas → API → PostgreSQL
2. **User Runs Simulation** → WebSocket → Simulation Engine → Redis (state) → WebSocket → Metrics Dashboard
3. **Real-time Updates** → WebSocket pushes metrics, bottlenecks, failures to frontend
4. **Cost Calculation** → Triggered on component changes → Cost Calculator → Redis cache
5. **Monitoring** → All services send metrics → Prometheus
