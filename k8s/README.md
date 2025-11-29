# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the OSRS Bingo Helper to your cluster.

## Prerequisites

- A running Kubernetes cluster
- `kubectl` configured to access your cluster
- Docker for building the image

## Deployment Steps

### 1. Build the Docker Image

```bash
# From the project root directory
docker build -t bingo-helper:latest .
```

### 2. Push to Your Registry (Optional)

If your cluster pulls from a registry, tag and push the image:

```bash
docker tag bingo-helper:latest your-registry.com/bingo-helper:latest
docker push your-registry.com/bingo-helper:latest
```

Then update `k8s/deployment.yaml` to use your registry image.

### 3. Deploy to Kubernetes

Deploy all resources:

```bash
kubectl apply -f k8s/
```

Or deploy individually:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml  # Optional, if you want external access
```

### 4. Verify Deployment

Check the deployment status:

```bash
kubectl get deployments
kubectl get pods
kubectl get services
```

### 5. Access the Application

#### Option A: Port Forward (for testing)

```bash
kubectl port-forward service/bingo-helper 8080:80
```

Then access at: http://localhost:8080

#### Option B: Using Ingress (for clan mates)

1. Edit `k8s/ingress.yaml` and replace `bingo.example.com` with your actual domain
2. Make sure you have an Ingress controller installed (e.g., nginx-ingress, traefik)
3. Apply the ingress: `kubectl apply -f k8s/ingress.yaml`
4. Configure your DNS to point to your ingress controller's IP
5. Share the URL with your clan mates!

#### Option C: LoadBalancer (if supported by your cluster)

Change the service type in `k8s/service.yaml` from `ClusterIP` to `LoadBalancer`:

```yaml
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
```

Then apply and get the external IP:

```bash
kubectl apply -f k8s/service.yaml
kubectl get service bingo-helper
```

## Scaling

To scale the number of replicas:

```bash
kubectl scale deployment bingo-helper --replicas=3
```

## Cleanup

To remove all resources:

```bash
kubectl delete -f k8s/
```

## Troubleshooting

View logs:
```bash
kubectl logs -l app=bingo-helper
```

Describe pods:
```bash
kubectl describe pods -l app=bingo-helper
```

Get events:
```bash
kubectl get events --sort-by='.lastTimestamp'
```
