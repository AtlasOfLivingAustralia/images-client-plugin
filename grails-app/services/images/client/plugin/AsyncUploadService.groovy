package images.client.plugin

import jakarta.servlet.http.HttpSession
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue

class AsyncUploadService {

    private static final Map<String, AsyncUploadStatus> _SessionImportMap = [:]

    def startImagesUpload(HttpSession session, List<Map> imageData) {

        AsyncUploadStatus jobStatus = null

        synchronized (_SessionImportMap) {
            if (_SessionImportMap.containsKey(session.id)) {
                return false
            }

            jobStatus = new AsyncUploadStatus(session.id)
            _SessionImportMap[session.id] = jobStatus
        }

        imageData.each { image ->
            jobStatus.queue.put(new ImageUploadJob(imageData: image, jobStatus: jobStatus))
            jobStatus.imageCount++
        }

        jobStatus.threadPool.submit(new Callable() {

            @Override
            Object call() throws Exception {
                while (!jobStatus.queue.isEmpty()) {
                    def job = jobStatus.queue.poll()
                    // upload image...
                }
            }
        })

    }


    def cancelImagesUpload(HttpSession session) {
        synchronized (_SessionImportMap) {
            if (_SessionImportMap.containsKey(session.id)) {
                def jobStatus = _SessionImportMap[session.id]
                jobStatus.queue.clear()
                _SessionImportMap.remove(session.id)
                return jobStatus.results
            }
        }
    }

}

class AsyncUploadStatus {

    public AsyncUploadStatus(String sessionId) {
        this.sessionId = sessionId
    }

    String sessionId
    Map<String, Map> results = [:]
    LinkedBlockingQueue<ImageUploadJob> queue = new LinkedBlockingQueue<ImageUploadJob>()
    int imageCount = 0
    ExecutorService threadPool = Executors.newFixedThreadPool(1);
}

public class ImageUploadJob {
    Map imageData
    AsyncUploadStatus jobStatus
}
