import axios, { type InternalAxiosRequestConfig, type AxiosRequestConfig, type CancelToken, type AxiosResponse, AxiosError } from 'axios'
import SHA256 from 'crypto-js/sha256'

export type RequestOptions = AxiosRequestConfig & { hideError?: boolean }
export type ResponseHandlerType = ((res: AxiosResponse) => Promise<boolean> | boolean) | false
export interface ResponseData {
  code: string
  message?: string
  data?: any
}

// export const baseUrl = process.env.NODE_ENV !== 'production' ? '/api' : '/'

const axiosConfig = {
  baseURL: baseUrl,
  timeout: 30000 // 请求超时时间
}
const service = axios.create(axiosConfig)

let isShowConfirm = false
/**
 * 自定义响应处理函数，用于针对错误信息做自定义处理，默认处理：显示错误内容
 * @param { Object } respData  服务端返回带错误的内容
 * @return { Boolean | Promise } 返回true时不执行默认处理，返回false时执行默认处理，返回Promise时Promise作为响应处理
 */
let responseHandler: ResponseHandlerType = false // function(respData)

// 判断是刷新页面还是关闭页面
let isFreshPage = false
export function getAndResetRefresh() {
  const tempFreshPage = isFreshPage
  isFreshPage = false
  return tempFreshPage
}

export async function wrapRequest(config: InternalAxiosRequestConfig) {
  if (!config.headers) {
    config.headers = new axios.AxiosHeaders() // {}
  }
  const appStore = useAppStore()
  const timeStamp = Date.now() + appStore.timeOffset
  // 由于headers的参数到interceptors.request后会转成驼峰式的，所以这里统一将Content-Type改成驼峰式确保判断正常
  if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json'
  }
  config.headers['x-oc-version'] = VERSION
  config.headers['x-oc-timestamp'] = timeStamp
  config.headers.Accept = 'application/json'
  config.headers.apifoxToken = 'O6zs6zFCQi70L3D25oLbJaaaBIJ2wGGE' // 云端mock需要添加的header
  const str = config.url + config.headers['x-oc-timestamp'] + config.headers['x-oc-version'] + appKey + secret
  // console.log('str: ', str, appStore.timeOffset, appStore.token)
  config.headers.Authorization = `SHA-256 ${appKey} ${SHA256(str)}`
  if (appStore.token) {
    config.headers['x-oc-token'] = appStore.token
  }
  return config
}

function filterNullParam(requestParams: Record<string, any>) {
  if (typeof requestParams !== 'object') {
    return requestParams
  }
  const queryParams: Record<string, any> = {}
  Object.keys(requestParams).forEach(key => {
    if (requestParams[key]) {
      // if (Array.isArray(requestParams[key])) {
      //   if (requestParams[key].length > 0) {
      //     queryParams[key] = requestParams[key]
      //   }
      // } else {
      queryParams[key] = requestParams[key]
      // }
    }
  })
  return queryParams
}

// service.interceptors.response.use(response => {
//   // console.log('response:', response)
//   const resData = response.data || {}
//   const defErrorHandler = (resp: AxiosResponse) => {
//     const handlerResult = responseHandler && responseHandler(resp)
//     if (handlerResult && handlerResult !== true) {
//       return handlerResult.then(res => res ? resData : undefined)
//     }
//     const error = new AxiosError(resData.message || '请求异常')
//     error.response = resp
//     showError(error, resp.config)
//     return Promise.reject(error)
//   }
//   if (resData.code === '0' || response.config.url === FLUSH_URL) {
//     // 刷新token请求不走错误码处理流程，由业务逻辑自行处理
//     if (response.config.url !== FLUSH_URL) {
//       refreshTokenCount = 0
//     }
//     return resData
//   } else if (resData.code === '9' && response.config.url !== GET_APP_TIME_URL) {
//     // 时间不同步，请求时间
//     if (!getTimeReq) {
//       getTimeReq = getRequest(GET_APP_TIME_URL, {}).then(res => {
//         const systemTime = res.data?.time
//         if (systemTime) {
//           const appStore = useAppStore()
//           appStore.timeOffset = systemTime - Date.now()
//         }
//         getTimeReq = undefined
//         return true
//       }).catch(() => {
//         getTimeReq = undefined
//         return false
//       })
//     }
//     return getTimeReq.then(() => replayRequest(response.config))
//   } else if (resData.code === '1005' && response.config.url !== FLUSH_URL && refreshTokenCount < MAX_REFRESH_TOKEN_COUNT) {
//     // 会话失效，刷新token
//     if (!refreshTokenReq) {
//       const appStore = useAppStore()
//       refreshTokenReq = Promise.resolve(getTimeReq || true).then((result) => {
//         if (result && appStore.refreshToken) {
//           refreshTokenCount++
//           console.log('refreshTokenCount: ', refreshTokenCount)
//           return jsonRequest(FLUSH_URL, { refreshToken: appStore.refreshToken }).then(res => {
//             refreshTokenReq = undefined
//             if (res.code === '0') {
//               const { ...loginInfo } = res.data
//               if (loginInfo) {
//                 appStore.setLoginInfo(loginInfo)
//               }
//               return true
//             } else {
//               return false
//             }
//           }).catch(() => {
//             refreshTokenReq = undefined
//             return false
//           })
//         } else {
//           return false
//         }
//       })
//     }
//     return refreshTokenReq.then((result: boolean) => {
//       if (result === true) {
//         return replayRequest(response.config)
//       } else {
//         return defErrorHandler(response)
//       }
//     })
//   } else {
//     return defErrorHandler(response)
//   }
// }, errorHandler)

// 重放请求
function replayRequest(config: RequestOptions) {
  return request({
    url: config.url,
    method: config.method,
    data: typeof config.data === 'undefined' ? {} : typeof config.data === 'object' ? config.data : JSON.parse(config.data),
    hideError: config.hideError,
    cancelToken: undefined
  })
}

service.interceptors.request.use(wrapRequest)

const { CancelToken } = axios
const cancelSourceMap = new Map()

function request(options: RequestOptions) {
  if (!options.cancelToken) {
    const key = location.hash
    let source = cancelSourceMap.get(key)
    if (!source) {
      source = CancelToken.source()
      cancelSourceMap.set(key, source)
    }
    options.cancelToken = source.token
  } else {
    const key = options.cancelToken
    let source = cancelSourceMap.get(key)
    if (!source) {
      source = CancelToken.source()
      cancelSourceMap.set(key, source)
    }
    options.cancelToken = source.token
  }
  return service<any, ResponseData>(options)
}

export function cancelRequest(url: string) {
  console.log('cancel url: ', url)
  const source = cancelSourceMap.get(url)
  if (source) {
    source.cancel('cancel request')
    cancelSourceMap.delete(url)
  }
}

export function setResponseHandler(handler: (res: AxiosResponse) => Promise<boolean> | boolean) {
  if (typeof handler === 'function') {
    responseHandler = handler
  } else {
    console.error('handler is not a function')
  }
}

export function getRequest(url: string, data?: any, hideError?: boolean, cancelToken?: CancelToken) {
  // console.log('发起请求: 地址:', url, '  header:', header);
  // if (data) {
  //   data._t = Date.now()
  // } else {
  //   data = { _t: Date.now() }
  // }

  return request({
    url,
    method: 'GET',
    params: data,
    hideError,
    cancelToken
  })
}

import type { AxiosProgressEvent } from 'axios'
export function putRequest(url: string, data = {}, callback, hideError = false, cancelToken?: CancelToken) {
  // 需要传入data，否则axios不会添加Content-Type请求头
  return request({
    url,
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    data,
    hideError,
    cancelToken,
    timeout: 0,
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      console.log('putRequest onUploadProgress', progressEvent)
      callback(progressEvent.progress)
    }
  })
}

export function delRequest(url: string, data = {}, hideError = false, cancelToken?: CancelToken) {
  // 需要传入data，否则axios不会添加Content-Type请求头
  return request({
    url,
    method: 'DELETE',
    data,
    hideError,
    cancelToken
  })
}

export function jsonRequest(url: string, data: any, hideError?: boolean, cancelToken?: CancelToken) {
  return request({
    url,
    method: 'POST',
    data,
    hideError,
    cancelToken
  })
}

/**
 * 上传文件
 * @param {String} url 上传文件地址
 * @param {Object} data 上传文件数据对象
 * @param {Boolean} hideError 是否不显示错误信息
 */
export function uploadFile(url: string, data: any, hideError?: boolean) {
  const formData = new FormData()

  Object.keys(data).forEach(key => {
    formData.append(key, data[key])
  })

  return request({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    data: formData,
    hideError
  })
}

/**
 * 二进制方式上传文件
 * @param {String} url 上传文件地址
 * @param {Blob} data 上传文件数据对象
 * @param {Boolean} hideError 是否不显示错误信息
 */
export function uploadFile4Blob(url: string, data: Blob, hideError?: boolean) {
  return request({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    data: data,
    // onUploadProgress: onUploadProgress
    hideError
  })
}

export default request
