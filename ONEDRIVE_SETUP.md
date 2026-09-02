# Activar Nube (OneDrive / Microsoft Graph)

El ERP ya usa esta arquitectura:

`Frontend -> Firebase Callable Functions -> Microsoft Graph -> OneDrive / SharePoint`

No usa `local-api` ni expone secretos en React. Para habilitar **Nube** faltan únicamente la aplicación de Microsoft Entra, cinco secretos de Graph y desplegar las Functions de Nube.

## 1. Elegir el OneDrive corporativo

La opción más simple para NOOVA es usar el OneDrive de una cuenta Microsoft 365 corporativa que ya tenga OneDrive aprovisionado.

Ejemplo:

```text
GRAPH_DRIVE_TYPE = user
GRAPH_DRIVE_ID = administracion@dominio-noova.com
```

`GRAPH_DRIVE_ID` es el correo/UPN del usuario dueño del OneDrive. El ERP también soporta `site` y `group`, pero `user` es la configuración recomendada para empezar.

## 2. Crear la aplicación en Microsoft Entra

1. Entra a Microsoft Entra Admin Center con una cuenta administradora del tenant de NOOVA.
2. Ve a **App registrations -> New registration**.
3. Nombre sugerido: `NOOVA ERP`.
4. Selecciona **Accounts in this organizational directory only**.
5. Copia:
   - **Directory (tenant) ID** -> `GRAPH_TENANT_ID`
   - **Application (client) ID** -> `GRAPH_CLIENT_ID`
6. Ve a **Certificates & secrets -> Client secrets -> New client secret**.
7. Copia el **Value** del secreto -> `GRAPH_CLIENT_SECRET`.
   No uses el Secret ID.

## 3. Dar permisos de Microsoft Graph

En **API permissions -> Add a permission -> Microsoft Graph -> Application permissions** agrega:

- `Files.ReadWrite.All`

Luego pulsa **Grant admin consent** y confirma que el permiso aparece concedido.

Para el módulo Nube no hace falta `Mail.Send` ni `GRAPH_MAIL_SENDER`.

## 4. Preparar Firebase Functions

Desde la raíz del proyecto:

```powershell
cd functions
npm install
cd ..
firebase login
firebase use noova-sac
```

El proyecto está preparado para Node.js 22 en Functions.

## 5. Guardar los cinco secretos de Nube

Ejecuta uno por uno:

```powershell
firebase functions:secrets:set GRAPH_TENANT_ID
firebase functions:secrets:set GRAPH_CLIENT_ID
firebase functions:secrets:set GRAPH_CLIENT_SECRET
firebase functions:secrets:set GRAPH_DRIVE_TYPE
firebase functions:secrets:set GRAPH_DRIVE_ID
```

Para OneDrive de usuario:

```text
GRAPH_DRIVE_TYPE = user
GRAPH_DRIVE_ID = correo corporativo dueño del OneDrive
```

No pongas el Client Secret en `.env`, GitHub ni el frontend.

## 6. Verificar el perfil del ERP

Las Functions de Nube verifican Firebase Auth y el permiso `nube` del perfil en `users/{uid}`.

El usuario administrador debe tener un documento de perfil activo, por ejemplo:

```text
activo: true
role: administrador
```

Los colaboradores deben tener `nube` dentro de sus permisos o heredarlo de su rol.

## 7. Desplegar SOLO las Functions de Nube

```powershell
firebase deploy --only functions:nubeListarCarpeta,functions:nubeObtenerLinkDescarga,functions:nubeBuscarDocumentos,functions:nubeObtenerContexto,functions:nubeCrearCarpeta,functions:nubeSubirArchivo,functions:nubeRenombrarItem,functions:nubeEliminarItem
```

No necesitas modificar Firestore Rules para conectar Microsoft Graph.

## 8. Validación completa

Entra al ERP con un usuario con permiso `nube` y prueba, en este orden:

1. Abrir **Nube**.
2. Listar la raíz del OneDrive.
3. Crear una carpeta `PRUEBA ERP`.
4. Entrar a la carpeta.
5. Subir un archivo menor de 4 MB.
6. Abrir el archivo mediante su enlace web.
7. Renombrarlo.
8. Buscarlo desde Nube.
9. Eliminarlo y verificar la papelera de OneDrive.

La subida directa actual admite archivos menores de 4 MB. Para archivos mayores habría que implementar upload sessions de Microsoft Graph.

## 9. Diagnóstico

Si falla, consulta los logs:

```powershell
firebase functions:log --only nubeObtenerContexto,nubeListarCarpeta
```

Errores típicos:

- **Microsoft Graph no está configurado**: falta uno de los cinco secretos o las Functions no fueron redesplegadas.
- **Microsoft Graph rechazó las credenciales**: Tenant ID, Client ID o Client Secret incorrecto/expirado.
- **Permisos insuficientes**: falta `Files.ReadWrite.All` como Application permission o falta **Grant admin consent**.
- **No se encontró el OneDrive configurado**: `GRAPH_DRIVE_ID` no corresponde a una cuenta con OneDrive provisionado, o `GRAPH_DRIVE_TYPE` es incorrecto.

## 10. Frontend

Nube usa `httpsCallable` del SDK de Firebase, por lo que no debe llamar URLs `cloudfunctions.net` manualmente ni depender de CORS configurado por el frontend.

Después de verificar todo localmente:

```powershell
npm install
npm run build
firebase deploy --only hosting
```
