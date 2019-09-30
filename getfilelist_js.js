"use strict";
/**
 * GetFileList for Javascript library
 * GitHub  https://github.com/tanaikech/GetFileList_js<br>
 */
(function(r) {
  let GetFileList;
  GetFileList = (function() {
    function GetFileList() {
      this.obj = {};
    }

    /**
     * Retrieve folder tree.
     * @param {Object} resource the object for retrieving folder tree.
     * @return {Object} Folder tree.
     */
    GetFileList.prototype.getFolderTree = function(resource) {
      return new Promise((resolve, reject) => {
        this.obj = { resource: resource };
        init.call(this, err => {
          if (err) {
            reject(err);
            return;
          }
          if (this.obj.method) {
            getFromAllFolders.call(this, (err, folderTree) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(folderTree);
            });
          } else {
            getFolderTreeRecursively.call(this, (err, folderTree) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(folderTree);
            });
          }
        });
      });
    };

    /**
     * Retrieve file list with the folder structure.
     * @param {Object} resource the object for retrieving file list.
     * @return {Object} File list.
     */
    GetFileList.prototype.getFileList = function(resource) {
      return new Promise((resolve, reject) => {
        this.obj = { resource: resource };
        init.call(this, err => {
          if (err) {
            reject(err);
            return;
          }
          if (this.obj.method) {
            getFromAllFolders.call(this, (err, folderTree) => {
              if (err) {
                reject(err);
                return;
              }
              getFilesFromFolder
                .call(this, folderTree)
                .then(res => {
                  resolve(res);
                })
                .catch(err => {
                  reject(err);
                });
            });
          } else {
            getFolderTreeRecursively.call(this, (err, folderTree) => {
              if (err) {
                reject(err);
                return;
              }
              getFilesFromFolder
                .call(this, folderTree)
                .then(res => {
                  resolve(res);
                })
                .catch(err => {
                  reject(err);
                });
            });
          }
        });
      });
    };

    const init = function(callback) {
      const rootId = this.obj.resource.id.toLowerCase() == "root";
      if (
        "apiKey" in this.obj.resource &&
        !("accessToken" in this.obj.resource) &&
        rootId
      ) {
        callback(
          "All folders in Google Drive cannot be retrieved using API key. Please use OAuth2."
        );
        return;
      }
      // In order to use this library with Google Apps Script, the template literals cannot be used in the script.
      // const endpoint = `https://www.googleapis.com/drive/v3/files/${this.obj.resource.id}`;
      const endpoint =
        "https://www.googleapis.com/drive/v3/files/" + this.obj.resource.id;
      const [apiKey, accessToken] = checkTokens.call(this);
      const chkAuth = apiKey || accessToken ? true : false;
      const qs = {
        fields:
          "createdTime,id,mimeType,modifiedTime,name,owners,parents,shared,webContentLink,webViewLink"
      };
      let params = {
        method: "GET"
      };
      if (accessToken) {
        params.headers = new Headers({
          Authorization: "Bearer " + accessToken
        });
      } else if (apiKey) {
        qs.key = apiKey;
      }
      const query =
        "?" +
        Object.keys(qs)
          .map(e => encodeURIComponent(e) + "=" + encodeURIComponent(qs[e]))
          .join("&");
      fetch(endpoint + query, params)
        .then(res => {
          return res.json();
        })
        .then(val => {
          if ("error" in val) {
            callback(val);
          }
          this.obj.searchedFolder = val;
          this.obj.method =
            (chkAuth || rootId) && !this.obj.searchedFolder.shared;
          callback(null);
        })
        .catch(err => {
          callback(err);
        });
    };

    const checkTokens = function() {
      let apiKey = "";
      let accessToken = "";
      if (
        ("apiKey" in this.obj.resource && "accessToken" in this.obj.resource) ||
        (!("apiKey" in this.obj.resource) && "accessToken" in this.obj.resource)
      ) {
        accessToken = this.obj.resource.accessToken;
      } else if (
        "apiKey" in this.obj.resource &&
        !("accessToken" in this.obj.resource)
      ) {
        apiKey = this.obj.resource.apiKey;
      } else if (
        !("apiKey" in this.obj.resource) &&
        !("accessToken" in this.obj.resource)
      ) {
        callback("Please use apiKey or accessToken");
      }
      return [apiKey, accessToken];
    };

    const getFolderTreeRecursively = function(callback) {
      let folderTr = { search: this.obj.searchedFolder.id, temp: [] };
      getAllfoldersRecursively
        .call(this, this.obj.searchedFolder.id, [], folderTr)
        .then(value => {
          const res = getDlFoldersS.call(this, value);
          callback(null, res);
        })
        .catch(err => {
          callback(err, null);
        });
    };

    const getAllfoldersRecursively = async function(id, parents, folders) {
      // In order to use this library with Google Apps Script, the template literals cannot be used in the script.
      // const q = `'${id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const q =
        "'" +
        id +
        "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false";
      const fields = "files(id,mimeType,name,parents,size),nextPageToken";
      const files = await getListLoop.call(this, q, fields, []);
      const temp = files.map(e => {
        return {
          name: e.name,
          id: e.id,
          parent: e.parents[0],
          tree: parents.concat(id)
        };
      });
      if (temp.length > 0) {
        folders.temp.push(temp);
        for (let i = 0; i < temp.length; i++) {
          await getAllfoldersRecursively.call(
            this,
            temp[i].id,
            temp[i].tree,
            folders
          );
        }
      }
      return folders;
    };

    const getList = function(ptoken, q, fields) {
      return new Promise((resolve, reject) => {
        const endpoint = "https://www.googleapis.com/drive/v3/files";
        const [apiKey, accessToken] = checkTokens.call(this);
        const qs = {
          q: q,
          fields: fields,
          orderBy: "name",
          pageSize: 1000,
          pageToken: ptoken || ""
        };
        let params = {
          method: "GET"
        };
        if (accessToken) {
          params.headers = new Headers({
            Authorization: "Bearer " + accessToken
          });
        } else if (apiKey) {
          qs.key = apiKey;
        }
        const query =
          "?" +
          Object.keys(qs)
            .map(e => encodeURIComponent(e) + "=" + encodeURIComponent(qs[e]))
            .join("&");

        fetch(endpoint + query, params)
          .then(res => {
            return res.json();
          })
          .then(val => {
            if ("error" in val) {
              reject(val);
              return;
            }
            resolve(val);
          })
          .catch(err => {
            reject(err);
          });
      });
    };

    const getFromAllFolders = function(callback) {
      const q =
        "mimeType='application/vnd.google-apps.folder' and trashed=false";
      const fields = "files(id,mimeType,name,parents,size),nextPageToken";
      getListLoop
        .call(this, q, fields, [])
        .then(files => {
          let tr = { search: this.obj.searchedFolder.id, temp: [] };
          const value = createFolderTreeID.call(
            this,
            files,
            this.obj.searchedFolder.id,
            [],
            tr
          );
          const res = getDlFoldersS.call(this, value);
          callback(null, res);
        })
        .catch(err => {
          callback(err, null);
        });
    };

    const createFolderTreeID = function(fm, id, parents, fls) {
      const temp = fm.reduce((ar, e, i) => {
        if ("parents" in e && e.parents.length > 0 && e.parents[0] == id) {
          const t = {
            name: e.name,
            id: e.id,
            parent: e.parents[0],
            tree: parents.concat(id)
          };
          ar.push(t);
        }
        return ar;
      }, []);
      if (temp.length > 0) {
        fls.temp.push(temp);
        for (let i = 0; i < temp.length; i++) {
          createFolderTreeID(fm, temp[i].id, temp[i].tree, fls);
        }
      }
      return fls;
    };

    const getFilesFromFolder = async function(folderTree) {
      const e = this.obj;
      let f = {
        searchedFolder: e.searchedFolder,
        folderTree: folderTree,
        fileList: []
      };
      const fields = (() => {
        if (!e.resource.fields) {
          return "files(createdTime,description,id,mimeType,modifiedTime,name,owners,parents,permissions,shared,size,webContentLink,webViewLink),nextPageToken";
        }
        if (!~e.resource.fields.indexOf("nextPageToken")) {
          e.resource.fields += ",nextPageToken";
        }
        return e.resource.fields;
      })();
      for (let i = 0; i < folderTree.folders.length; i++) {
        const id = folderTree.folders[i];
        // In order to use this library with Google Apps Script, the template literals cannot be used in the script.
        // const q = `'${id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;
        const q =
          "'" +
          id +
          "' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false";
        const fm = await getListLoop.call(this, q, fields, []);
        let fe = { files: [] };
        fe.folderTree = folderTree.id[i];
        fe.files = fe.files.concat(fm);
        f.fileList.push(fe);
      }
      f.totalNumberOfFolders = f.folderTree.folders.length;
      f.totalNumberOfFiles = (() => {
        return f.fileList.reduce((c, f) => {
          c += f.files.length;
          return c;
        }, 0);
      })();
      return f;
    };

    const getListLoop = async function(q, fields, list) {
      let NextPageToken = "";
      do {
        const res = await getList.call(this, NextPageToken, q, fields);
        Array.prototype.push.apply(list, res.files);
        NextPageToken = res.nextPageToken;
      } while (NextPageToken);
      return list;
    };

    const getDlFoldersS = function(fr) {
      let fT = { id: [], names: [], folders: [] };
      fT.id.push([fr.search]);
      fT.names.push(this.obj.searchedFolder.name);
      fT.folders.push(fr.search);
      for (let i = 0; i < fr.temp.length; i++) {
        let e = fr.temp[i];
        for (let j = 0; j < e.length; j++) {
          let f = e[j];
          fT.folders.push(f.id);
          let tmp = [];
          fT.id.push(tmp.concat(f.tree).concat(f.id));
          fT.names.push(f.name);
        }
      }
      return fT;
    };

    return GetFileList;
  })();

  return (r.GetFileList = GetFileList);
})(this);
