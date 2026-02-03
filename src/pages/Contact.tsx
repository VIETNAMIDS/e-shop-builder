import { Navbar } from '@/components/Navbar';
import { Mail, Phone, Facebook, MessageCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Contact() {
  const contactInfo = [
    {
      icon: MessageCircle,
      label: 'Zalo',
      value: '0785000270',
      link: 'https://zalo.me/0785000270',
      color: 'bg-blue-500/20 text-blue-400'
    },
    {
      icon: Facebook,
      label: 'Facebook',
      value: 'Thắng Zợi Nguyễn',
      link: 'http://lcebook.com/taoxinloividaluadoi',
      color: 'bg-indigo-500/20 text-indigo-400'
    },
    {
      icon: Mail,
      label: 'Gmail',
      value: 'congviecmet@gmail.com',
      link: 'mailto:congviecmet@gmail.com',
      color: 'bg-red-500/20 text-red-400'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gradient">Liên hệ</span> với chúng tôi
            </h1>
            <p className="text-muted-foreground text-lg">
              Bạn có thắc mắc hoặc cần hỗ trợ? Hãy liên hệ qua các kênh bên dưới.
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid gap-6">
            {contactInfo.map((contact) => (
              <a
                key={contact.label}
                href={contact.link}
                target="_blank"
                rel="noopener noreferrer"
                className="glass p-6 rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl ${contact.color} flex items-center justify-center`}>
                      <contact.icon className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{contact.label}</p>
                      <p className="text-xl font-semibold">{contact.value}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </a>
            ))}
          </div>

          {/* Additional Info */}
          <div className="mt-12 text-center glass p-8 rounded-2xl border border-border/50">
            <h2 className="text-2xl font-bold mb-4">Giờ làm việc</h2>
            <p className="text-muted-foreground mb-2">Thứ 2 - Thứ 7: 8:00 - 22:00</p>
            <p className="text-muted-foreground mb-6">Chủ nhật: 9:00 - 18:00</p>
            <p className="text-sm text-muted-foreground">
              Chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
