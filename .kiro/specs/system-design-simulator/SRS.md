# Software Requirements Specification (SRS)

## System Design Simulation & Learning Platform (SaaS)

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for a SaaS-based System Design Learning and Simulation Platform that enables users to visually design, simulate, and analyze real-world distributed systems under varying scale and constraints, from 1 user to 1 billion users.

The SRS is intended for:

- Product designers
- Backend & frontend engineers
- System architects
- Stakeholders and investors

### 1.2 Scope

The platform provides:

- A visual drag-drop canvas for system design
- Realistic traffic & load simulation
- Failure and constraint injection
- Live metrics & cost modeling
- Guided learning scenarios
- Collaboration and SaaS-based access

The system focuses on conceptual correctness and behavioral realism, not real infrastructure provisioning.

### 1.3 Definitions & Acronyms

- **Node**: A system component (DB, Cache, LB, Service, etc.)
- **Edge**: Communication link between nodes
- **Simulation Tick**: Discrete time step in system simulation
- **QPS**: Queries Per Second
- **DAG**: Directed Acyclic Graph
- **SaaS**: Software as a Service

## 2. Overall Description

### 2.1 Product Perspective

The platform acts as a distributed systems simulator, similar to:

- Tinkercad (electronics simulation)
- Langflow (visual LLM pipelines)

but focused on system design and scalability behavior.

It is a greenfield product, independent of any existing system.

### 2.2 User Classes

| User Type | Description |
| --- | --- |
| Learner | Students, job-seekers learning system design |
| Engineer | Practicing engineers experimenting with architectures |
| Instructor | Teachers creating guided scenarios |
| Interview Candidate | Users practicing system design interviews |
| Admin | Platform administrators |

### 2.3 Operating Environment

- Web browser (desktop-first)
- Cloud-hosted backend
- Stateless simulation execution
- Real-time WebSocket communication

### 2.4 Design Constraints

- Simulations must run within bounded compute
- Results must be deterministic per seed
- System behavior must be explainable
- Multi-user isolation required

## 3. System Features & Functional Requirements

### 3.1 User Authentication & Account Management

**Description**  
Users must be able to create accounts and manage saved designs.

**Functional Requirements**

- **FR-1.1**: Users shall be able to sign up using email or OAuth
- **FR-1.2**: Users shall be able to log in and log out
- **FR-1.3**: Users shall be able to save, load, and delete designs
- **FR-1.4**: The system shall support free and paid tiers

### 3.2 Visual System Design Canvas

**Description**  
A drag-drop canvas where users build system architectures.

**Functional Requirements**

- **FR-2.1**: Users shall be able to drag components onto the canvas
- **FR-2.2**: Users shall be able to connect components using edges
- **FR-2.3**: Each component shall expose configurable parameters
- **FR-2.4**: The system shall prevent invalid connections
- **FR-2.5**: Users shall be able to group and label components

### 3.3 Component Library

**Description**  
Predefined system components with realistic behavior models.

**Functional Requirements**

- **FR-3.1**: The system shall provide standard components (LB, DB, Cache, Queue, CDN, Service)
- **FR-3.2**: Each component shall have capacity limits
- **FR-3.3**: Components shall expose scaling strategies (vertical/horizontal)
- **FR-3.4**: Components shall expose consistency and replication options

### 3.4 Traffic & Load Simulation Engine

**Description**  
Simulates traffic flow and system behavior under scale.

**Functional Requirements**

- **FR-4.1**: Users shall be able to set user count or QPS
- **FR-4.2**: The system shall propagate load through the graph
- **FR-4.3**: The system shall model queueing and backpressure
- **FR-4.4**: The system shall simulate retries and timeouts
- **FR-4.5**: The system shall support bursty and steady traffic

### 3.5 Scale Control

**Description**  
Allows simulation from 1 user to 1 billion users.

**Functional Requirements**

- **FR-5.1**: Users shall be able to change scale dynamically
- **FR-5.2**: System metrics shall update in real time
- **FR-5.3**: Bottlenecks shall be visually highlighted
- **FR-5.4**: System collapse scenarios shall be detectable

### 3.6 Failure & Constraint Injection

**Description**  
Enables users to introduce real-world failures.

**Functional Requirements**

- **FR-6.1**: Users shall be able to disable components
- **FR-6.2**: Users shall be able to inject latency
- **FR-6.3**: Users shall be able to simulate network partitions
- **FR-6.4**: Users shall be able to simulate regional outages
- **FR-6.5**: Recovery behavior shall be observable

### 3.7 Metrics & Observability Dashboard

**Description**  
Displays live system behavior.

**Functional Requirements**

- **FR-7.1**: The system shall display latency (p50, p95, p99)
- **FR-7.2**: The system shall display error rates
- **FR-7.3**: The system shall display throughput
- **FR-7.4**: The system shall display resource saturation
- **FR-7.5**: Metrics shall be node-specific and global

### 3.8 Cost Modeling Engine

**Description**  
Estimates cost impact of system design choices.

**Functional Requirements**

- **FR-8.1**: The system shall estimate compute costs
- **FR-8.2**: The system shall estimate storage costs
- **FR-8.3**: The system shall estimate network costs
- **FR-8.4**: Costs shall scale with traffic
- **FR-8.5**: Users shall see cost vs performance tradeoffs

### 3.9 Learning & Scenario Mode

**Description**  
Guided learning experiences.

**Functional Requirements**

- **FR-9.1**: The system shall provide predefined scenarios
- **FR-9.2**: Scenarios shall introduce constraints progressively
- **FR-9.3**: The system shall provide hints and explanations
- **FR-9.4**: Scenarios shall track completion and progress

### 3.10 Collaboration

**Description**  
Multi-user collaboration on designs.

**Functional Requirements**

- **FR-10.1**: Users shall be able to share designs
- **FR-10.2**: Multiple users shall edit the same canvas
- **FR-10.3**: Changes shall sync in real time
- **FR-10.4**: Version history shall be maintained

## 4. Non-Functional Requirements

### 4.1 Performance

- **NFR-1**: Simulation updates shall occur within 100ms per tick
- **NFR-2**: UI interactions shall feel real-time
- **NFR-3**: Concurrent simulations shall be isolated

### 4.2 Scalability

- **NFR-4**: System shall support thousands of concurrent users
- **NFR-5**: Simulation load shall scale horizontally

### 4.3 Reliability

- **NFR-6**: No user simulation shall affect another
- **NFR-7**: System shall recover from partial failures
- **NFR-8**: User data shall be persisted reliably

### 4.4 Security

- **NFR-9**: All user data shall be access-controlled
- **NFR-10**: Designs shall be private by default
- **NFR-11**: Secure authentication mechanisms required

### 4.5 Usability

- **NFR-12**: UI shall be intuitive without prior training
- **NFR-13**: Visual feedback must clearly indicate failures
- **NFR-14**: System must support keyboard & mouse controls

### 4.6 Maintainability

- **NFR-15**: Component models shall be modular
- **NFR-16**: New components can be added without breaking existing ones
- **NFR-17**: Simulation logic shall be testable and deterministic

## 5. Assumptions & Dependencies

- Users have basic system design knowledge
- Platform is educational, not production infra
- Behavior models approximate real-world systems
- Cloud pricing models may be simplified

## 6. Future Enhancements (Out of Scope for MVP)

- Real cloud provider configuration import
- AI-based design critique
- Auto-optimization suggestions
- Competitive benchmarking modes

## 7. Approval

This SRS serves as the baseline contract for development and iteration.