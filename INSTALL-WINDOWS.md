# Hermes WebUI — Installation locale Windows (Docker)

Installation fonctionnelle dans `D:\Projet\outils\hermes-webui`.

## Acces
- URL : http://localhost:8787
- Mot de passe : `hermes-local-2026` (defini dans `.env`)

## Arborescence
- `D:\Projet\outils\hermes-webui\` : le WebUI (docker-compose + override)
- `D:\Projet\outils\hermes-agent\` : l'agent (clone sibling)
- `D:\Projet\outils\hermes-data\.hermes\` : etat/config Hermes (monte dans le conteneur)
- `D:\Projet\outils\hermes-data\workspace\` : workspace par defaut (navigateur de fichiers)

## Commandes usuelles (depuis `D:\Projet\outils\hermes-webui`)
```powershell
docker compose ps              # etat
docker compose logs --tail 50 # logs
docker compose restart        # redemarrer
docker compose down           # arreter
docker compose up -d          # demarrer (sans rebuild)
```

## Important : dependances de l'agent
Le conteneur WebUI possede son propre venv (`/app/venv`). Les dependances de l'agent
(`run_agent`, `python-dotenv`, etc.) doivent etre installees dans ce venv. Elles sont
perdues en cas de `docker compose up -d --build` (reconstruction de l'image).

Reinstallation apres un rebuild :
```powershell
docker compose exec -T hermes-webui bash -lc "cd /hermes-agent && /app/venv/bin/python -m pip install -e ."
docker compose restart
```

## Notes Windows
- Les scripts shell du depot ont ete convertis en LF (fins de ligne Unix) car Git
  avait applique `autocrlf=true` et cassait les shebangs dans le conteneur.
- `core.autocrlf` desactive sur le depot hermes-webui pour eviter le probleme.
- Le conteneur ecoute sur `127.0.0.1:8787` (localhost uniquement). Pour un acces
  reseau, ouvrir le port dans `docker-compose.yml` et garder le mot de passe actif.
- Provider IA : configurer un provider (OpenAI/Anthropic/OpenRouter/local) dans
  Settings -> Providers apres la premiere connexion pour activer le chat.