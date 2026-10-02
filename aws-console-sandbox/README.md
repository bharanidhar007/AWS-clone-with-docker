# AWS Console Practice Sandbox

A local, simulated AWS console — VPC, subnets, route tables, Internet Gateway,
NAT Gateway, security groups, EC2 instances, EBS volumes, S3, an Application
Load Balancer, and Auto Scaling groups — with a real backend and database, so
everything you create is actually persisted, not just held in browser memory.
No real AWS account is used and no real AWS API calls are made.

## Stack

- **Backend:** Node.js + Express, REST API under `/api/*`
- **Database:** SQLite (via `better-sqlite3`), file stored at `data/sandbox.db`
- **Frontend:** plain HTML/CSS/JS console UI, served by the same Express app

Every "Create" action (VPC, subnet, instance, volume, bucket, load balancer,
ASG…) does a real `POST` to the backend, which writes a row to SQLite. The UI
re-fetches from `GET /api/state` after every change, so what you see is always
what's in the database — restart the server and your resources are still there.

## Run with Docker (recommended)

    docker compose up -d --build

Then open http://localhost:8080. Resource data is kept in a named Docker
volume (`sandbox-data`) so it survives `docker compose down` / restarts.
Remove it with `docker compose down -v` to start completely fresh.

Or without Compose:

    docker build -t aws-console-sandbox .
    docker run -d -p 8080:4000 -v aws-sandbox-data:/app/data aws-console-sandbox

## Run without Docker

Requires Node.js 20+ and a C/C++ toolchain (for the SQLite native module).

    cd backend
    npm install
    npm start

Then open http://localhost:4000.

## Project structure

    backend/
      server.js       Express app + all REST endpoints
      db.js            SQLite connection + generic table helper
      regions.js       Region / Availability Zone reference data
      seed.js          Lazy per-region default VPC/subnets/IGW/route table/SG
      package.json
    public/
      index.html       page shell (top nav incl. region selector)
      css/style.css    AWS-console styling
      js/api.js        fetch wrapper + client-side state cache
      js/core.js       router, sidebar, region switching, boot
      js/pages.js      every service page + create/action handlers
    Dockerfile
    docker-compose.yml
    data/              SQLite database file lives here when run outside Docker

## Regions & Availability Zones

Use the region selector in the top bar to switch between 8 regions
(us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-central-1,
ap-south-1, ap-southeast-1), each with a realistic AZ count (e.g. us-east-1
has 6 AZs, us-west-1 has 2). Switching regions changes which AZs show up in
every dropdown, and — just like real AWS — the first time you visit a region
it gets its own default VPC, default subnets, Internet Gateway, main route
table and default security group.

## API reference (selected)

    GET    /api/state?region=us-east-1     everything the UI needs, in one call
    POST   /api/vpcs                       { name, cidr, tenancy, region }
    POST   /api/subnets                    { vpcId, name, az, cidr, autoAssignPublicIp }
    POST   /api/instances                  launches an instance + its root EBS volume
    POST   /api/instances/:id/action       { state: "running"|"stopped"|"terminated" }
    POST   /api/volumes                    { size, type, az, region }
    POST   /api/volumes/:id/attach         { instanceId }
    POST   /api/buckets                    { name, region, blockAll, versioning }
    POST   /api/load-balancers             { name, scheme, vpcId, subnets[], ... }
    POST   /api/asgs                       { name, ltId, vpcId, subnets[], desired, min, max }
    POST   /api/asgs/:id/scale             { delta: 1 | -1 }
    POST   /api/reset                      wipes the database and reseeds defaults

Full list is in `backend/server.js`.

## Notes

- This was built and syntax-checked in a sandboxed environment without
  internet access, so `npm install` / the Docker build itself could not be
  executed here — run `docker compose up -d --build` (or `npm install`
  locally) to pull dependencies and do a real end-to-end test on your machine.
- Object "uploads" in S3 just record a name/size in the database — no real
  file bytes are stored.
