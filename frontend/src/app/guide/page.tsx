export default function GuidePage() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Giới thiệu hệ thống hỗ trợ chẩn đoán bệnh lý phổi từ ảnh X-quang ngực
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-red-500 to-blue-500 mx-auto rounded-full"></div>
        </div>

        {/* Introduction */}
        <div className="mb-10">
          <p className="text-gray-700 leading-relaxed text-lg">
            Hệ thống được xây dựng nhằm hỗ trợ quá trình chẩn đoán bệnh lý phổi từ ảnh X-quang ngực, cung cấp thông tin tham khảo cho người dùng đồng thời giúp lưu trữ và tư vấn thông tin liên quan đến các bệnh lý phổi liên quan. Hệ thống được thiết kế với giao diện trực quan với các chức năng chính:
          </p>
        </div>

        {/* Features */}
        <div className="space-y-8 mb-10">
          {/* Feature 1 */}
          <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-6 border border-red-200/50 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-3 rounded-xl shadow-lg flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M13.96 12.29L11.21 15.83L9.25 13.47L6.5 17H17.5L13.96 12.29Z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-3">1. Chẩn đoán bệnh</h2>
                <p className="text-gray-700 leading-relaxed">
                  Hệ thống cho phép người dùng tải ảnh X-quang ngực, sau đó mô hình AI sẽ phân tích và dự đoán các bất thường liên quan đến bệnh lý phổi, đồng thời hiển thị vùng khoanh bất thường cùng độ tin cậy của dự đoán.
                </p>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-6 border border-blue-200/50 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.5 14.33C18.29 14.33 19.13 14.41 20 14.57V16.07C19.38 15.91 18.54 15.83 17.5 15.83C15.6 15.83 14.11 16.16 13 16.82V15.13C14.17 14.6 15.67 14.33 17.5 14.33M13 12.46C14.29 11.93 15.79 11.67 17.5 11.67C18.29 11.67 19.13 11.74 20 11.9V13.4C19.38 13.24 18.54 13.16 17.5 13.16C15.6 13.16 14.11 13.5 13 14.15M17.5 10.5C15.6 10.5 14.11 10.82 13 11.5V9.84C14.23 9.28 15.73 9 17.5 9C18.29 9 19.13 9.08 20 9.23V10.78C19.26 10.59 18.41 10.5 17.5 10.5M21 18.5V7C19.96 6.67 18.79 6.5 17.5 6.5C15.45 6.5 13.62 7 12 8V19.5C13.62 18.5 15.45 18 17.5 18C18.69 18 19.86 18.16 21 18.5M17.5 4.5C19.85 4.5 21.69 5 23 6V20.56C23 20.68 22.95 20.8 22.84 20.91C22.73 21 22.61 21.08 22.5 21.08C22.39 21.08 22.31 21.06 22.25 21.03C20.97 20.34 19.38 20 17.5 20C15.45 20 13.62 20.5 12 21.5C10.66 20.5 8.83 20 6.5 20C4.84 20 3.25 20.36 1.75 21.07C1.72 21.08 1.68 21.08 1.63 21.1C1.59 21.11 1.55 21.12 1.5 21.12C1.39 21.12 1.27 21.08 1.16 21C1.05 20.89 1 20.78 1 20.65V6C2.34 5 4.18 4.5 6.5 4.5C8.83 4.5 10.66 5 12 6C13.34 5 15.17 4.5 17.5 4.5Z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-3">2. Chatbot tư vấn</h2>
                <p className="text-gray-700 leading-relaxed">
                  Cho phép người dùng tương tác với chatbot để tìm hiểu các thông tin cơ bản về bệnh lý phổi liên quan đến kết quả phân tích ảnh X-quang, bao gồm khái niệm, triệu chứng và biểu hiện thường gặp. Chatbot chỉ cung cấp thông tin tham khảo tổng quan và không thực hiện chẩn đoán chuyên sâu hay thay thế ý kiến của bác sĩ.
                </p>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-6 border border-green-200/50 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.5 8H12V13L16.28 15.54L17 14.33L13.5 12.25V8M13 3C8.03 3 4 7.03 4 12H1L4.96 16.03L9 12H6C6 8.13 9.13 5 13 5C16.87 5 20 8.13 20 12C20 15.87 16.87 19 13 19C11.07 19 9.32 18.21 8.06 16.94L6.64 18.36C8.27 20 10.5 21 13 21C17.97 21 22 16.97 22 12C22 7.03 17.97 3 13 3Z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-3">3. Lịch sử upload ảnh</h2>
                <p className="text-gray-700 leading-relaxed">
                  Lưu trữ tất cả các ảnh X-quang đã được tải lên hệ thống, cho phép người dùng xem lại ảnh, theo dõi kết quả phân tích, thống kê.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border-2 border-yellow-300/50 shadow-lg">
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-3 rounded-xl shadow-lg flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-4">4. Lưu ý khi sử dụng:</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                  <p className="text-gray-700 leading-relaxed">
                    <span className="font-semibold">Chỉ upload ảnh X-quang ngực</span> - Hệ thống được huấn luyện chuyên biệt cho ảnh X-quang ngực
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                  <p className="text-gray-700 leading-relaxed">
                    <span className="font-semibold">Ảnh nên rõ nét, đúng định dạng JPG/PNG</span> - Chất lượng ảnh tốt giúp kết quả phân tích chính xác hơn
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                  <p className="text-gray-700 leading-relaxed">
                    <span className="font-semibold">Kết quả chỉ mang tính tham khảo</span> - Không thay thế chẩn đoán của bác sĩ chuyên khoa
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                  <p className="text-gray-700 leading-relaxed">
                    <span className="font-semibold">Gặp lỗi?</span> - Hãy thử tải lại trang hoặc liên hệ hỗ trợ kỹ thuật
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            ⚕️ Kết quả từ hệ thống chỉ mang tính chất tham khảo. <br />
            Vui lòng tham khảo ý kiến bác sĩ chuyên khoa để được chẩn đoán và điều trị chính xác.
          </p>
        </div>
      </div>
    </div>
  );
}
