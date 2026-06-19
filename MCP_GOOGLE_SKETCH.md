# Configuración MCP - Google Sketch Integration

## 🔌 Model Context Protocol (MCP)

Este archivo configura la integración de Google Sketch con Copilot CLI.

## Cómo Activar Google Sketch

### 1. Desde el CLI
```bash
/mcp
```
Verás un menú para gestionar MCP servers.

### 2. Agregar Google Sketch MCP Server
```bash
/mcp add
```
Luego selecciona o ingresa la configuración para Google Sketch.

## Configuración Recomendada

```json
{
  "mcp_servers": {
    "google_sketch": {
      "command": "npx",
      "args": ["@google-sketch/mcp-server"],
      "enabled": true,
      "env": {
        "GOOGLE_API_KEY": "${GOOGLE_API_KEY}",
        "GOOGLE_PROJECT_ID": "${GOOGLE_PROJECT_ID}"
      }
    }
  }
}
```

## Variables de Entorno Requeridas

Crea un archivo `.env.local` con:

```env
# Google Cloud
GOOGLE_API_KEY=your_api_key_here
GOOGLE_PROJECT_ID=your_project_id_here

# Google Sketch
GOOGLE_SKETCH_API_ENDPOINT=https://design.google.com/api
```

## Capacidades Disponibles

Con Google Sketch integrado, el agente Design Web puede:

✅ Acceder a diseños guardados en Google Sketch
✅ Leer especificaciones de componentes
✅ Exportar assets y ícones
✅ Sincronizar paletas de colores
✅ Acceder a guías de tipografía
✅ Importar estilos a Tailwind CSS
✅ Generar código de componentes

## Comandos en el Agente Design Web

Una vez conectado, puedes usar:

```
@design-web
> Revisa mis diseños en Google Sketch: [url del proyecto]
> Exporta los estilos de color a una paleta Tailwind
> Crea componentes React basados en estos diseños
> Genera la documentación de componentes
```

## Troubleshooting

### Error: "Servidor MCP no disponible"
```bash
/mcp
# Verifica que Google Sketch MCP esté habilitado
# Revisa las credenciales en .env
```

### Error: "Acceso denegado"
- Verifica `GOOGLE_API_KEY` válida
- Confirma permisos en Google Cloud Console
- Comprueba que el proyecto está activo

### Error: "Conexión rechazada"
- Revisa conectividad a internet
- Verifica endpoint de Google Sketch
- Reinicia Copilot CLI: `Ctrl+D` y vuelve a iniciar

## Próximos Pasos

1. Obtén credenciales de Google Cloud (Google Sketch API)
2. Crea archivo `.env.local` con las claves
3. Ejecuta `/mcp` en Copilot CLI
4. Agrega el servidor Google Sketch
5. ¡Comienza a diseñar con sincronización automática!

---

**Documentación Oficial:**
- [Google Sketch API](https://developers.google.com/sketch)
- [MCP Specification](https://modelcontextprotocol.io)
- [Copilot MCP Integration](https://docs.github.com/en/copilot)
